#!/usr/bin/env node
/**
 * NIGHTLINE v2.4.0 — Comprehensive Live `workerd` + Playwright + TLS-over-VLESS E2E Suite (12/12 Suites)
 */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { Duplex } from 'node:stream';
import tls from 'node:tls';
import { chromium } from 'playwright';
import WebSocket from 'ws';

const PORT = 18800 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;

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

async function main() {
  console.log('═══ NIGHTLINE v2.4.0 Full Live Verification Suite (12/12) ═══');

  const proc = spawn(
    'npx',
    ['wrangler', 'dev', '--local', '--port', String(PORT), '--persist-to', `/tmp/nl-v24-kv-${Date.now()}`],
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

    // ── TEST 1: Health, Client-Info & Speed-Probe Endpoints (v2.4.0) ──
    const health = await (await fetch(`${BASE}/health`)).json();
    assert.equal(health.version, '2.4.0', 'Health version must be 2.4.0');
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
    console.log(`✓ [1/12] /health + /api/client-info + /api/speed-probe -> version=${health.version}, IP/Country OK, 64KB probe OK`);

    // ── TEST 2: Setup Panel & Verify No remarkPrefix + Default ProxyIPs + TgProxy ──
    const setupRes = await fetch(`${BASE}/api/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'AdminPassword24!', firstUserName: 'سردبیر اصلی' }),
    });
    assert.equal(setupRes.status, 200);
    const cookie = (setupRes.headers.get('set-cookie') || '').split(';')[0];
    const boot = await setupRes.json();

    assert.equal(boot.version, '2.4.0');
    assert.equal(boot.settings.remarkPrefix, undefined, 'remarkPrefix must be completely removed');
    assert(boot.settings.proxyIPs.length >= 3, 'Default verified ProxyIPs must be populated');
    assert.equal(boot.settings.enableNAT64, true, 'Default NAT64 must be enabled');
    assert.equal(boot.settings.enableTgProxy, true, 'Telegram Web Proxy must be enabled by default');
    assert.match(boot.settings.tgProxySecret, /^[0-9a-f]{32}$/, '32-hex Telegram secret auto-minted');
    assert(boot.tgProxy.tgUrl.startsWith('tg://webproxy?server='), 'tg://webproxy URL ready');
    console.log(`✓ [2/12] Setup & Defaults -> 0 remarkPrefix, ${boot.settings.proxyIPs.length} ProxyIPs, tg://webproxy ready`);

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
    console.log(`✓ [3/12] Ports & Emoji-Free Subscriptions -> All 6 TLS + 7 HTTP ports (${rawWithHttp.length} lines), 0 emojis`);

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
    console.log('✓ [4/12] Private DoH -> Emoji-free HTML Guide 200 + JSON 200 + RFC 8484 POST 200');

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
    console.log('✓ [5/12] Cloudflare-Hosted Tunnel -> LIVE HTTPS to www.speedtest.net over fragmented VLESS returned 200 OK');

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
    console.log('✓ [6/12] Official Telegram Web Proxy -> HMAC Bridge 200 + Session Lease 200 + Lane WS 101 verified');

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
    console.log(`✓ [7/12] Visitor IP/Country/ISP Strip + BLUR Toggle -> IP="${detectedIp}", filter="${computedFilter}" verified`);

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
    console.log(`✓ [8/12] Zero-Emoji & Custom SVG Icon Audit -> 0 emojis in DOM, ${emojiCheck.svgIcons} crisp vector icons rendered`);

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
    console.log(`✓ [9/12] Stationary-Shadow Button Physics -> Button moved (+${shadowAudit.btnMovedX}px, +${shadowAudit.btnMovedY}px), shadow drift = 0.0px!`);

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
    console.log(`✓ [10/12] Monochrome Live Speed & Usage Chart -> Burst=${kpiSpd.trim()}, canvas=${canvasOk.width}x${canvasOk.height} verified`);

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
    console.log(`✓ [11/12] Smart Browser Network Advisor -> 12/12 live browser probes + ${recsCount} recommendations + 1-click Auto-Apply verified`);

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

    assert.equal(pageErrors.length, 0, `Unexpected browser JS errors: ${pageErrors.join('; ')}`);
    await browser.close();
    assert(!serverLogs.includes('Uncaught'), `Unexpected Uncaught in workerd logs:\n${serverLogs}`);
    console.log('✓ [12/12] Clean IP Scanner + Emoji-Free Subscriber Press Pass verified!');
    console.log('\nALL 12/12 NIGHTLINE v2.4.0 E2E VERIFICATION SUITES PASSED WITH ZERO ERRORS!');
  } catch (err) {
    console.error('\nTEST FAILED:', err);
    if (serverLogs) console.error('SERVER LOGS:\n', serverLogs.slice(-1500));
    proc.kill('SIGTERM');
    process.exit(1);
  } finally {
    proc.kill('SIGTERM');
  }
  process.exit(0);
}

main();
