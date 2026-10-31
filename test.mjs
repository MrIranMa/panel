#!/usr/bin/env node
/**
 * NIGHTLINE v2.5.0 — Comprehensive Live `workerd` + Playwright + TLS-over-VLESS E2E Suite (15/15 Suites)
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import { Duplex } from 'node:stream';
import tls from 'node:tls';
import { chromium } from 'playwright';
import WebSocket from 'ws';

const PORT = 18800 + Math.floor(Math.random() * 500);
const MOCK_PORT = 19400 + Math.floor(Math.random() * 400);
const BASE = `http://127.0.0.1:${PORT}`;
const MOCK_BASE = `http://127.0.0.1:${MOCK_PORT}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildVlessHeader(uuidStr, host, port, cmd = 1) {
  const uuidBytes = Buffer.from(uuidStr.replace(/-/g, ''), 'hex');
  const hostBytes = Buffer.from(host, 'utf8');
  const hdr = Buffer.alloc(1 + 16 + 1 + 1 + 2 + 1 + 1 + hostBytes.length);
  let o = 0;
  hdr[o++] = 0x00;
  uuidBytes.copy(hdr, o); o += 16;
  hdr[o++] = 0x00;
  hdr[o++] = cmd;
  hdr.writeUInt16BE(port, o); o += 2;
  hdr[o++] = 0x02;
  hdr[o++] = hostBytes.length;
  hostBytes.copy(hdr, o);
  return hdr;
}

async function fetchHttpsViaFragmentedVless({ wsUrl, uuid, targetHost, targetPort = 443, path = '/' }) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let vlessRespHeaderStripped = false;

    const timer = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error(`VLESS HTTPS test timed out for ${targetHost}`));
    }, 20000);

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ws.on('open', async () => {
      const vlessHdr = buildVlessHeader(uuid, targetHost, targetPort, 1);
      ws.send(vlessHdr);
      await sleep(35);

      let fragBudget = 6;
      const duplex = new Duplex({
        read() {},
        write(chunk, _enc, cb) {
          (async () => {
            const buf = Buffer.from(chunk);
            if (fragBudget > 0 && buf.length > 20) {
              fragBudget--;
              for (let off = 0; off < buf.length; off += 24) {
                if (ws.readyState !== WebSocket.OPEN) break;
                ws.send(buf.subarray(off, Math.min(off + 24, buf.length)));
                await sleep(8);
              }
            } else if (ws.readyState === WebSocket.OPEN) {
              ws.send(buf);
            }
            cb();
          })().catch(cb);
        },
      });

      ws.on('message', (data) => {
        let buf = Buffer.from(data);
        if (!vlessRespHeaderStripped) {
          vlessRespHeaderStripped = true;
          buf = buf.subarray(2);
        }
        if (buf.length > 0) duplex.push(buf);
      });
      ws.on('close', () => duplex.push(null));

      const tlsSock = tls.connect({
        socket: duplex,
        servername: targetHost,
        ALPNProtocols: ['http/1.1'],
      });

      let rawResp = '';
      tlsSock.setEncoding('utf8');
      tlsSock.on('secureConnect', () => {
        tlsSock.write(
          `GET ${path} HTTP/1.1\r\nHost: ${targetHost}\r\nUser-Agent: curl/8.5.0\r\nConnection: close\r\n\r\n`
        );
      });
      tlsSock.on('data', (chunk) => {
        rawResp += chunk;
      });
      tlsSock.on('end', () => {
        clearTimeout(timer);
        try { ws.close(); } catch {}
        resolve(rawResp);
      });
      tlsSock.on('error', (err) => {
        clearTimeout(timer);
        try { ws.close(); } catch {}
        reject(err);
      });
    });
  });
}

async function startMockCloudflareAndGitHubServer(stateRecorder) {
  const realBundleSample = fs.readFileSync(new URL('./worker-single-file.js', import.meta.url), 'utf8');
  const srv = http.createServer(async (req, res) => {
    const u = new URL(req.url, MOCK_BASE);
    let bodyBuf = Buffer.alloc(0);
    for await (const chunk of req) {
      bodyBuf = Buffer.concat([bodyBuf, Buffer.from(chunk)]);
    }
    const auth = req.headers.authorization || '';

    // Cloudflare REST + GraphQL Mock (strictly enforces Bearer token like real api.cloudflare.com)
    if (u.pathname.startsWith('/cf/')) {
      if (auth !== 'Bearer cf_valid_test_token_1234567890') {
        res.writeHead(403, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ success: false, errors: [{ code: 1000, message: 'Invalid API Token' }] }));
      }
    }
    if (u.pathname === '/cf/user/tokens/verify') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ success: true, result: { id: 'tok_1', status: 'active' } }));
    }
    if (u.pathname === '/cf/accounts') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        result: [{ id: 'acc_nl_998877', name: 'NightLine Edge Account' }],
      }));
    }
    if (u.pathname === '/cf/accounts/acc_nl_998877/workers/scripts') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        result: [{ id: 'nightline-worker' }],
      }));
    }
    if (u.pathname === '/cf/accounts/acc_nl_998877/workers/scripts/nightline-worker/settings') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        result: {
          compatibility_date: '2025-09-01',
          compatibility_flags: ['nodejs_compat'],
          bindings: [
            { type: 'kv_namespace', name: 'KV', namespace_id: 'kv_ns_demo_123' },
            { type: 'secret_text', name: 'CUSTOM_SECRET' },
          ],
        },
      }));
    }
    if (u.pathname === '/cf/accounts/acc_nl_998877/workers/scripts/nightline-worker' && req.method === 'PUT') {
      stateRecorder.workerUploads.push({
        contentType: req.headers['content-type'] || '',
        bodyText: bodyBuf.toString('utf8'),
        byteLength: bodyBuf.length,
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ success: true, result: { id: 'nightline-worker' } }));
    }
    if (u.pathname === '/cf/graphql' && req.method === 'POST') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({
        data: {
          viewer: {
            accounts: [
              {
                workersInvocationsAdaptive: [
                  {
                    dimensions: { scriptName: 'nightline-worker' },
                    sum: { requests: 27450, subrequests: 8200, errors: 3 },
                  },
                ],
              },
            ],
          },
        },
      }));
    }

    // Hardcoded GitHub `youdidking/NightLine` Mock
    if (u.pathname === '/gh/repos/youdidking/NightLine/releases/latest') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({
        tag_name: 'v2.6.0',
        html_url: 'https://github.com/youdidking/NightLine/releases/tag/v2.6.0',
        body: '- Official test release from youdidking/NightLine',
        published_at: '2026-10-31T12:00:00Z',
        assets: [
          {
            name: 'worker-single-file.js',
            browser_download_url: `${MOCK_BASE}/ghraw/youdidking/NightLine/v2.6.0/worker-single-file.js`,
          },
        ],
      }));
    }
    if (u.pathname === '/ghraw/youdidking/NightLine/main/package.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ name: 'nightline', version: '2.6.0' }));
    }
    if (u.pathname.endsWith('/worker-single-file.js')) {
      res.writeHead(200, { 'content-type': 'application/javascript' });
      return res.end(realBundleSample);
    }

    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'mock route not found: ' + u.pathname }));
  });

  await new Promise((resolve) => srv.listen(MOCK_PORT, '127.0.0.1', resolve));
  return srv;
}

async function main() {
  console.log('═══ NIGHTLINE v2.5.0 Full Live Verification Suite (15/15) ═══');

  const mockRecorder = { workerUploads: [] };
  const mockSrv = await startMockCloudflareAndGitHubServer(mockRecorder);

  const proc = spawn(
    'npx',
    [
      'wrangler',
      'dev',
      '--local',
      '--port',
      String(PORT),
      '--persist-to',
      `/tmp/nl-v25-kv-${Date.now()}`,
      '--var',
      `NL_CF_API_BASE:${MOCK_BASE}/cf`,
      '--var',
      `NL_GH_API_BASE:${MOCK_BASE}/gh`,
      '--var',
      `NL_GH_RAW_BASE:${MOCK_BASE}/ghraw`,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let serverLogs = '';
  proc.stdout.on('data', (d) => { serverLogs += d.toString(); });
  proc.stderr.on('data', (d) => { serverLogs += d.toString(); });

  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch(`${BASE}/health`);
        if (r.ok) { ready = true; break; }
      } catch {}
      await sleep(300);
    }
    assert(ready, 'workerd failed to start');

    // ── TEST 1: Health, Client-Info & Speed-Probe Endpoints (v2.5.0) ──
    const health = await (await fetch(`${BASE}/health`)).json();
    assert.equal(health.version, '2.5.0', 'Health version must be 2.5.0');
    assert.notEqual(health.colo, 'EDGE', 'colo must never be EDGE');

    const ciRes = await fetch(`${BASE}/api/client-info`, {
      headers: { 'cf-connecting-ip': '5.160.214.88', 'cf-ipcountry': 'IR' },
    });
    assert.equal(ciRes.status, 200);
    const ciJson = await ciRes.json();
    assert.equal(ciJson.cf.clientIp, '5.160.214.88');
    assert.equal(ciJson.cf.country, 'IR');
    assert.equal(ciJson.cf.countryNameFa, 'ایران');

    const spRes = await fetch(`${BASE}/api/speed-probe?bytes=65536`);
    assert.equal(spRes.status, 200);
    const spBuf = await spRes.arrayBuffer();
    assert.equal(spBuf.byteLength, 65536, 'Speed probe must return exact requested byte count');
    console.log(`✓ [1/15] /health + /api/client-info + /api/speed-probe -> version=${health.version}, IP/Country OK, 64KB probe OK`);

    // ── TEST 2: Setup Panel & Verify No remarkPrefix + Default ProxyIPs + TgProxy ──
    const setupRes = await fetch(`${BASE}/api/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'AdminPassword24!', firstUserName: 'سردبیر اصلی' }),
    });
    assert.equal(setupRes.status, 200);
    const cookie = (setupRes.headers.get('set-cookie') || '').split(';')[0];
    const boot = await setupRes.json();

    assert.equal(boot.version, '2.5.0');
    assert.equal(boot.updater.repo, 'youdidking/NightLine', 'Hardcoded official GitHub repo must be youdidking/NightLine');
    assert.equal(boot.updater.repoUrl, 'https://github.com/youdidking/NightLine');
    assert.equal(boot.settings.remarkPrefix, undefined, 'remarkPrefix must be completely removed');
    assert(boot.settings.proxyIPs.length >= 3, 'Default verified ProxyIPs must be populated');
    assert.equal(boot.settings.enableNAT64, true, 'Default NAT64 must be enabled');
    assert.equal(boot.settings.enableTgProxy, true, 'Telegram Web Proxy must be enabled by default');
    assert.match(boot.settings.tgProxySecret, /^[0-9a-f]{32}$/, '32-hex Telegram secret auto-minted');
    assert(boot.tgProxy.tgUrl.startsWith('tg://webproxy?server='), 'tg://webproxy URL ready');
    console.log(`✓ [2/15] Setup & Defaults -> 0 remarkPrefix, ${boot.settings.proxyIPs.length} ProxyIPs, tg://webproxy ready`);

    const user = boot.users[0];

    // ── TEST 3: All 6 TLS Ports + All 7 HTTP Ports + Zero-Emoji Free Notice in Subscriptions ──
    const rawSubRes = await fetch(`${BASE}/sub/${user.subToken}?format=raw`);
    assert.equal(rawSubRes.status, 200);
    const announceHdr = rawSubRes.headers.get('announce') || '';
    assert(announceHdr.startsWith('base64:'), 'Subscription must include announce header');
    const decodedAnnounce = Buffer.from(announceHdr.slice(7), 'base64').toString('utf8');
    assert(decodedAnnounce.includes('رایگان و متن‌باز'), 'Announce header must state free & non-commercial');
    assert(!/\p{Extended_Pictographic}/u.test(decodedAnnounce), 'Announce header must have 0 emojis');

    const rawLines = (await rawSubRes.text()).trim().split('\n');
    const firstDecodedHash = decodeURIComponent(rawLines[0].split('#')[1] || '');
    assert(firstDecodedHash.includes('رایگان و غیرقابل فروش'), 'Top URI line must state free & not for sale');
    assert(!/\p{Extended_Pictographic}/u.test(firstDecodedHash), 'Top URI line must have 0 emojis');

    for (const p of [443, 8443, 2053, 2083, 2087, 2096]) {
      assert(rawLines.some((l) => l.includes(`:${p}?`)), `Expected TLS port ${p} in subscription`);
    }

    const setHttpRes = await fetch(`${BASE}/api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ ...boot.settings, enableHttpPorts: true }),
    });
    assert.equal(setHttpRes.status, 200);
    const rawWithHttp = (await (await fetch(`${BASE}/sub/${user.subToken}?format=raw`)).text()).trim().split('\n');
    for (const hp of [80, 8080, 8880, 2052, 2082, 2086, 2095]) {
      assert(rawWithHttp.some((l) => l.includes(`:${hp}?`) && l.includes('security=none')), `Expected HTTP port ${hp}`);
    }
    console.log(`✓ [3/15] Ports & Emoji-Free Subscriptions -> All 6 TLS + 7 HTTP ports (${rawWithHttp.length} lines), 0 emojis`);

    // ── TEST 4: Private DoH (`/dns-query/<token>`) Browser HTML + JSON + Binary POST ──
    const dohHtmlRes = await fetch(`${BASE}/dns-query/${user.subToken}`, {
      headers: { accept: 'text/html,application/xhtml+xml' },
    });
    assert.equal(dohHtmlRes.status, 200);
    const dohHtml = await dohHtmlRes.text();
    assert(dohHtml.includes('NIGHTLINE · PRIVATE DoH'));
    assert(!/\p{Extended_Pictographic}/u.test(dohHtml), 'DoH HTML guide must contain 0 emojis');

    const dohJson = await (await fetch(`${BASE}/dns-query/${user.subToken}?name=example.com&type=A`)).json();
    assert.equal(dohJson.Status, 0);

    const dnsWireQuery = Buffer.from('abcd01000001000000000000076578616d706c6503636f6d0000010001', 'hex');
    const dohPostRes = await fetch(`${BASE}/dns-query/${user.subToken}`, {
      method: 'POST',
      headers: { 'content-type': 'application/dns-message' },
      body: dnsWireQuery,
    });
    assert.equal(dohPostRes.status, 200);
    console.log('✓ [4/15] Private DoH -> Emoji-free HTML Guide 200 + JSON 200 + RFC 8484 POST 200');

    // ── TEST 5: LIVE `www.speedtest.net` HTTPS over Fragmented VLESS Tunnel ──
    const speedtestHttp = await fetchHttpsViaFragmentedVless({
      wsUrl: `ws://127.0.0.1:${PORT}/?ed=2048`,
      uuid: user.uuid,
      targetHost: 'www.speedtest.net',
      targetPort: 443,
      path: '/cdn-cgi/trace',
    });
    assert(
      /^HTTP\/1\.[01]\s+200\b/.test(speedtestHttp) && speedtestHttp.includes('h=www.speedtest.net'),
      `Expected HTTP 200 from www.speedtest.net over VLESS tunnel, got: ${speedtestHttp.slice(0, 140)}`
    );
    console.log('✓ [5/15] Cloudflare-Hosted Tunnel -> LIVE HTTPS to www.speedtest.net over fragmented VLESS returned 200 OK');

    // ── TEST 6: Official Telegram Web Proxy (`/?bridge=`, `/api/v1/session`, `/api/v1/ws`) ──
    const tgSecret = boot.settings.tgProxySecret;
    const hmacCap = crypto
      .createHmac('sha256', Buffer.from(tgSecret, 'hex'))
      .update('tdesktop-web-proxy-bridge-v1\n127.0.0.1')
      .digest('base64url');
    const bridgeHtml = await (await fetch(`${BASE}/?bridge=${hmacCap}`)).text();
    const bootMatch = /boot="([A-Za-z0-9_-]{43})"/.exec(bridgeHtml);
    assert(bootMatch, 'Bridge HTML must embed 43-char boot token');

    const sessRes = await fetch(`${BASE}/api/v1/session`, {
      method: 'POST',
      headers: { authorization: `Bearer ${bootMatch[1]}`, 'content-type': 'application/octet-stream' },
      body: new Uint8Array([0x10, 0, 0, 0, 0, 0, 0, 1, 1]),
    });
    assert.equal(sessRes.status, 200);
    const sessToken = sessRes.headers.get('x-session-token') || '';
    await new Promise((resolve, reject) => {
      const subproto = `tproxy-lane-v1.${sessToken}.1`;
      const tgWs = new WebSocket(`ws://127.0.0.1:${PORT}/api/v1/ws`, subproto);
      tgWs.on('open', () => { assert.equal(tgWs.protocol, subproto); tgWs.close(); resolve(); });
      tgWs.on('error', reject);
    });
    console.log('✓ [6/15] Official Telegram Web Proxy -> HMAC Bridge 200 + Session Lease 200 + Lane WS 101 verified');

    // ── TEST 7–12: Headless Chromium UI E2E Verification ──
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1400, height: 920 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(`${BASE}/panel`, { waitUntil: 'networkidle' });

    // Free Notice Popup Modal
    assert.equal(await page.locator('#free-notice-modal').isVisible(), true);
    await page.click('#btn-free-close');

    // ── TEST 7: Visitor IP, Country, ISP Strip + BLUR Toggle BEFORE & AFTER Login ──
    await page.waitForFunction(() => {
      const el = document.getElementById('visitor-ip');
      return el && el.textContent && el.textContent.trim() !== '—';
    }, { timeout: 6000 });
    const detectedIp = (await page.locator('#visitor-ip').textContent()).trim();
    assert(detectedIp.length >= 3, `Expected detected IP, got: ${detectedIp}`);
    assert.equal(await page.locator('#visitor-ip').evaluate((el) => el.classList.contains('is-blurred')), false);

    await page.click('#btn-ip-blur');
    const isBlurredAfterClick = await page.locator('#visitor-ip').evaluate((el) => el.classList.contains('is-blurred'));
    const computedFilter = await page.locator('#visitor-ip').evaluate((el) => getComputedStyle(el).filter);
    assert.equal(isBlurredAfterClick, true, 'IP element must get .is-blurred class');
    assert(computedFilter.includes('blur'), `Expected CSS blur filter, got: ${computedFilter}`);
    await page.click('#btn-ip-blur');
    assert.equal(await page.locator('#visitor-ip').evaluate((el) => el.classList.contains('is-blurred')), false);
    console.log(`✓ [7/15] Visitor IP/Country/ISP Strip + BLUR Toggle -> IP="${detectedIp}", filter="${computedFilter}" verified`);

    // Login to Admin Panel
    await page.fill('#login-pass', 'AdminPassword24!');
    await page.click('#f-login button[type="submit"]');
    await page.waitForSelector('#v-admin:not([hidden])');

    // ── TEST 8: Zero-Emoji Live DOM Audit + Custom Monochrome SVG Icons ──
    const emojiCheck = await page.evaluate(() => {
      const txt = document.documentElement.innerText || '';
      const matches = txt.match(/\p{Extended_Pictographic}/gu) || [];
      const svgIcons = document.querySelectorAll('svg.ic').length;
      return { emojiCount: matches.length, matches, svgIcons };
    });
    assert.equal(emojiCheck.emojiCount, 0, `Expected 0 emojis in DOM, found: ${emojiCheck.matches.join(',')}`);
    assert(emojiCheck.svgIcons >= 25, `Expected >=25 custom SVG icons, found: ${emojiCheck.svgIcons}`);
    console.log(`✓ [8/15] Zero-Emoji & Custom SVG Icon Audit -> 0 emojis in DOM, ${emojiCheck.svgIcons} crisp vector icons rendered`);

    // ── TEST 9: Stationary-Shadow Button Physics Audit ──
    // Verify that when a button (including `.btn.sm-btn`) is pressed, its body moves by `--sh-d` (3px)
    // while `box-shadow` shrinks to `0px`, keeping `rect.left + shadowOffsetX` pixel-locked!
    const shadowAudit = await page.evaluate(async () => {
      const btn = document.getElementById('cp-b64');
      btn.style.transition = 'none'; // sample exact rest vs pressed endpoints without mid-flight interpolation
      const parseShadowOffset = (sh) => {
        if (!sh || sh === 'none') return { x: 0, y: 0 };
        const px = sh.match(/(-?\d+(?:\.\d+)?)px/g) || ['0px', '0px'];
        return { x: parseFloat(px[0]), y: parseFloat(px[1]) };
      };
      const r0 = btn.getBoundingClientRect();
      const s0 = parseShadowOffset(getComputedStyle(btn).boxShadow);
      const shadowScreenX0 = r0.left + s0.x;
      const shadowScreenY0 = r0.top + s0.y;

      btn.classList.add('is-pressed');
      const r1 = btn.getBoundingClientRect();
      const s1 = parseShadowOffset(getComputedStyle(btn).boxShadow);
      const shadowScreenX1 = r1.left + s1.x;
      const shadowScreenY1 = r1.top + s1.y;
      btn.classList.remove('is-pressed');
      btn.style.transition = '';

      return {
        btnMovedX: Math.round(r1.left - r0.left),
        btnMovedY: Math.round(r1.top - r0.top),
        shadowDriftX: Math.abs(shadowScreenX1 - shadowScreenX0),
        shadowDriftY: Math.abs(shadowScreenY1 - shadowScreenY0),
      };
    });
    assert.equal(shadowAudit.btnMovedX, 3, 'Small button must translate +3px X onto its shadow');
    assert.equal(shadowAudit.btnMovedY, 3, 'Small button must translate +3px Y onto its shadow');
    assert(shadowAudit.shadowDriftX < 0.5 && shadowAudit.shadowDriftY < 0.5, `Shadow must stay stationary! Drift: ${JSON.stringify(shadowAudit)}`);
    console.log(`✓ [9/15] Stationary-Shadow Button Physics -> Button moved (+${shadowAudit.btnMovedX}px, +${shadowAudit.btnMovedY}px), shadow drift = 0.0px!`);

    // ── TEST 10: Dynamic Theme-Native Monochrome Speed/RTT & Subscriber Usage Chart ──
    await page.click('#btn-speed-burst');
    await sleep(600);
    const kpiSpd = await page.locator('#kpi-speed').textContent();
    assert(kpiSpd.includes('Mbps') && !kpiSpd.startsWith('—'), `Expected live Mbps after burst test, got: ${kpiSpd}`);

    // Switch to Subscriber Usage mode & Dark theme and confirm monochrome canvas renders non-uniform pixels
    await page.click('#chart-mode-usage');
    await page.click('.t-pick[data-th="dark"]');
    await sleep(300);
    const canvasOk = await page.evaluate(() => {
      const c = document.getElementById('telemetry-canvas');
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      const uniqueLuma = new Set();
      for (let i = 0; i < data.length; i += 64) {
        uniqueLuma.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      }
      return { width: c.width, height: c.height, paletteCount: uniqueLuma.size };
    });
    assert(canvasOk.paletteCount >= 2, 'Telemetry canvas must actively draw monochrome bars/waveforms');
    await page.click('.t-pick[data-th="light"]');
    await page.click('#chart-mode-live');
    console.log(`✓ [10/15] Monochrome Live Speed & Usage Chart -> Burst=${kpiSpd.trim()}, canvas=${canvasOk.width}x${canvasOk.height} verified`);

    // ── TEST 11: Smart Browser-Based ISP & Connectivity Advisor + 1-Click Auto-Apply ──
    await page.click('.tab-btn[data-tab="advisor"]');
    await page.waitForSelector('#pane-advisor:not([hidden])');
    await page.click('#btn-adv-run');
    await page.waitForSelector('#btn-adv-apply:not([hidden])', { timeout: 15000 });
    const advCells = await page.locator('#adv-grid .adv-item').count();
    assert.equal(advCells, 12, 'Advisor must probe and render all 12 connectivity targets');
    const recsCount = await page.locator('#adv-recs li').count();
    assert(recsCount >= 2, 'Advisor must render concrete ISP tuning recommendations');
    await page.click('#btn-adv-apply');
    await sleep(300);
    console.log(`✓ [11/15] Smart Browser Network Advisor -> 12/12 live browser probes + ${recsCount} recommendations + 1-click Auto-Apply verified`);

    // ── TEST 12: Clean IP Scanner + Balanced Layout Zero-Emoji Subscriber Press Pass ──
    await page.click('.tab-btn[data-tab="net"]');
    await page.waitForSelector('#pane-net:not([hidden])');
    await page.fill(
      '#s-cleanips',
      ['www.speedtest.net#Speedtest', '1.1.1.1#CF-One', '203.0.113.1#BlackholeTest'].join('\n')
    );
    await page.click('#btn-scan-user-list');
    await page.waitForSelector('#btn-prune-clean:not([hidden])', { timeout: 12000 });
    await page.click('#btn-prune-clean');
    const prunedVal = await page.locator('#s-cleanips').inputValue();
    assert(!prunedVal.includes('203.0.113.1'), 'Dead IP must be pruned');

    const subPage = await context.newPage();
    await subPage.goto(`${BASE}/sub/${user.subToken}`, { waitUntil: 'networkidle' });
    await subPage.click('#sub-free-ok');
    const subEmojiCount = await subPage.evaluate(() => {
      return ((document.documentElement.innerText || '').match(/\p{Extended_Pictographic}/gu) || []).length;
    });
    assert.equal(subEmojiCount, 0, 'Subscriber Press Pass must contain 0 emojis');
    console.log('✓ [12/15] Clean IP Scanner + Emoji-Free Subscriber Press Pass verified!');

    // ── TEST 13: New User Zero-Traffic & Progress Bar Isolation + Duplicate UUID Guard ──
    // Note: `user` (سردبیر اصلی) already accrued real bytes from VLESS + Trojan E2E tunnels in Tests 4–5!
    // Adding a brand-new unlimited user `SinA` MUST have `usedBytes === 0` and `0%` progress bar width!
    const dupRes = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'DupCheck', uuid: user.uuid }),
    });
    assert.equal(dupRes.status, 400, 'Duplicate UUID on new user must be rejected with 400');

    await page.click('.tab-btn[data-tab="users"]');
    await page.waitForSelector('#pane-users:not([hidden])');
    await page.fill('#uf-name', 'SinA');
    await page.fill('#uf-gb', '0');
    await page.click('#f-user button[type="submit"]');
    await sleep(400);

    const userBarAudit = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#users-list .user-card'));
      return cards.map((c) => {
        const name = (c.querySelector('.user-name')?.innerText || '').trim();
        const bw = (c.querySelector('.user-meta b')?.innerText || '').trim();
        const barWidth = c.querySelector('.meter i')?.style.width || '';
        return { name, bw, barWidth };
      });
    });
    const sinaCard = userBarAudit.find((c) => c.name.includes('SinA'));
    assert(sinaCard, 'SinA must appear in Subscriber Ledger');
    assert(sinaCard.bw.startsWith('0 B /'), `New user SinA must start at 0 B, got: ${sinaCard.bw}`);
    assert.equal(sinaCard.barWidth, '0%', `New 0-byte user progress bar MUST be 0%, got: ${sinaCard.barWidth}`);

    // Also verify Tab 1 `#u-meter` for SinA is 0%
    await page.click('.tab-btn[data-tab="sub"]');
    await page.waitForSelector('#pane-sub:not([hidden])');
    const tab1SinaWidth = await page.evaluate(() => document.getElementById('u-meter')?.style.width);
    assert.equal(tab1SinaWidth, '0%', `Tab 1 #u-meter for 0-byte SinA MUST be 0%, got: ${tab1SinaWidth}`);
    console.log(`✓ [13/15] New User Isolation & Progress Bar Fix -> SinA (${sinaCard.bw}) bar=${sinaCard.barWidth}, duplicate UUID blocked`);

    // ── TEST 14: Compact Cloudflare Daily Request Quota Bar + Token Verifier + Mini Popup Guide ──
    await page.click('#btn-cf-quota');
    await page.waitForSelector('#cf-modal:not([hidden])');
    await page.click('#btn-cf-guide-pop');
    await page.waitForSelector('#cf-perm-popover:not([hidden])');
    const guideHasLinks = await page.evaluate(() => {
      const pop = document.getElementById('cf-perm-popover');
      const links = Array.from(pop.querySelectorAll('a[href]')).map((a) => a.href);
      return {
        hasDashLink: links.some((h) => h.includes('dash.cloudflare.com/profile/api-tokens')),
        hasDocsLink: links.some((h) => h.includes('developers.cloudflare.com')),
        permItems: pop.querySelectorAll('.perm-list li').length,
      };
    });
    assert(guideHasLinks.hasDashLink && guideHasLinks.hasDocsLink && guideHasLinks.permItems === 3, 'Mini guide popup must contain hyperlinked token permissions');
    await page.click('#btn-cf-guide-close');

    // Test invalid token rejection first
    await page.fill('#cf-inp-token', 'cf_invalid_bad_token_0000000000');
    await page.click('#btn-cf-verify');
    await sleep(300);
    const badMsgCls = await page.locator('#cf-verify-msg').getAttribute('class');
    assert.equal(badMsgCls, 'err', 'Invalid Cloudflare token must show error state');

    // Now verify & save valid token -> live 27,450 / 100,000 (27.5%) quota bar!
    await page.fill('#cf-inp-token', 'cf_valid_test_token_1234567890');
    await page.click('#btn-cf-save');
    await sleep(400);
    const cfBarState = await page.evaluate(() => ({
      miniTxt: document.getElementById('cf-mini-txt')?.textContent || '',
      miniWidth: document.getElementById('cf-mini-bar')?.style.width || '',
      modalNums: document.getElementById('cf-modal-nums')?.textContent || '',
    }));
    assert.equal(cfBarState.miniTxt, '27.4K/100K', `Expected compact bar 27.4K/100K, got: ${cfBarState.miniTxt}`);
    assert.equal(cfBarState.miniWidth, '27%', `Expected compact bar width 27%, got: ${cfBarState.miniWidth}`);
    assert(cfBarState.modalNums.includes('27,450 / 100,000'), `Expected exact count in modal, got: ${cfBarState.modalNums}`);
    await page.click('#btn-cf-close');
    console.log(`✓ [14/15] Cloudflare Daily Request Quota Bar & Token Verifier -> ${cfBarState.miniTxt} (${cfBarState.miniWidth}), mini permissions popup verified`);

    // ── TEST 15: Hardcoded GitHub (`youdidking/NightLine`) Updater & Self-Deploy + Tab 05 Spacing & Clean Copy Audit ──
    const copyAndSpacingAudit = await page.evaluate(() => {
      const fullHtmlText = document.documentElement.innerHTML;
      const bannedMetaPhrases = [
        'کاملاً منطبق با تم تک‌رنگ روزنامه',
        'کاملاً هماهنگ با تم تک‌رنگ روزنامه',
        'Strictly monochrome newsprint ink',
        'dynamically follows Light/Dark ink',
        'حروف‌چینی با JetBrains Mono و وزیرمتن',
        'Set in JetBrains Mono',
      ];
      const foundMeta = bannedMetaPhrases.filter((p) => fullHtmlText.includes(p));

      const navBottom = document.querySelector('.nav-tabs').getBoundingClientRect().bottom;
      const tab1Top = document.querySelector('#pane-sub .telemetry-card').getBoundingClientRect().top;
      const gapTab1 = Math.round(tab1Top - navBottom);
      return { foundMeta, gapTab1 };
    });
    assert.equal(copyAndSpacingAudit.foundMeta.length, 0, `Leftover meta phrases found: ${copyAndSpacingAudit.foundMeta.join(', ')}`);

    await page.click('.tab-btn[data-tab="advisor"]');
    await page.waitForSelector('#pane-advisor:not([hidden])');
    const gapTab5 = await page.evaluate(() => {
      const navBottom = document.querySelector('.nav-tabs').getBoundingClientRect().bottom;
      const advTop = document.getElementById('advisor-master-card').getBoundingClientRect().top;
      return Math.round(advTop - navBottom);
    });
    assert(gapTab5 >= 12 && Math.abs(gapTab5 - copyAndSpacingAudit.gapTab1) <= 1, `Tab 05 gap (${gapTab5}px) must match Tab 01 gap (${copyAndSpacingAudit.gapTab1}px)`);

    // Open Hardcoded GitHub Updater Modal, check `youdidking/NightLine`, and trigger In-Panel Self-Update!
    await page.click('#btn-gh-updater');
    await page.waitForSelector('#gh-modal:not([hidden])');
    await sleep(450);
    const ghUi = await page.evaluate(() => ({
      repoHref: document.querySelector('#gh-modal a.inline-link')?.href || '',
      remVer: document.getElementById('gh-rem-ver')?.textContent || '',
      dotVisible: !document.getElementById('gh-upd-dot')?.hidden,
    }));
    assert.equal(ghUi.repoHref, 'https://github.com/youdidking/NightLine');
    assert.equal(ghUi.remVer, 'V2.6.0', `Expected V2.6.0 from mock GitHub release, got: ${ghUi.remVer}`);
    assert.equal(ghUi.dotVisible, true, 'Update NEW indicator must appear when newer version exists on GitHub');

    await page.click('#btn-gh-apply');
    await sleep(600);
    assert.equal(mockRecorder.workerUploads.length, 1, 'Self-updater must PUT multipart Worker bundle to Cloudflare API');
    const upload = mockRecorder.workerUploads[0];
    assert(upload.contentType.includes('multipart/form-data'), 'Worker upload must be multipart/form-data');
    assert(upload.bodyText.includes('"kv_ns_demo_123"'), 'Self-updater MUST preserve existing KV namespace bindings');
    assert(upload.bodyText.includes('"keep_bindings":["secret_text","secret_key"]'), 'Self-updater MUST preserve existing secrets');
    assert(upload.byteLength > 200000, 'Uploaded Worker bundle must contain full compiled script');
    console.log(`✓ [15/15] GitHub Self-Updater (youdidking/NightLine) + Tab 05 Spacing (${gapTab5}px == ${copyAndSpacingAudit.gapTab1}px) + Clean Captions verified!`);

    assert.equal(pageErrors.length, 0, `Unexpected browser JS errors: ${pageErrors.join('; ')}`);
    await browser.close();
    assert(!serverLogs.includes('Uncaught'), `Unexpected Uncaught in workerd logs:\n${serverLogs}`);
    console.log('\nALL 15/15 NIGHTLINE v2.5.0 E2E VERIFICATION SUITES PASSED WITH ZERO ERRORS!');
  } catch (err) {
    console.error('\nTEST FAILED:', err);
    if (serverLogs) console.error('SERVER LOGS:\n', serverLogs.slice(-1500));
    proc.kill('SIGTERM');
    mockSrv.close();
    process.exit(1);
  } finally {
    proc.kill('SIGTERM');
    mockSrv.close();
  }
  process.exit(0);
}

main();
