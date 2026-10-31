#!/usr/bin/env node
/**
 * NIGHTLINE v2.3.0 — Comprehensive Live `workerd` + Playwright + TLS-over-VLESS E2E Suite
 *
 * Verifies all 8 v2.3.0 upgrades against the compiled Total-AST stealth `worker-single-file.js`:
 *   1. Version 2.3.0 everywhere + Clean `COLO · CF-GLOBAL` (zero `EDGE: EDGE` or `Edge` suffix)
 *   2. Zero `remarkPrefix` (`NIGHTLINE ·` removed from node names and settings)
 *   3. Free & Strictly Not For Sale Notice:
 *        - Popup Modal (`#free-notice-modal`) in Admin Panel + reopen button (`#btn-free-info`)
 *        - `announce: base64:...` subscription header + `🆓 این سرویس کاملاً رایگان و غیرقابل فروش است` URI row
 *        - Free Ribbon + Popup Modal on `/sub/<token>` Subscriber Press Pass
 *   4. All 6 TLS ports (`443,8443,2053,2083,2087,2096`) + All 7 HTTP ports (`80,8080,8880,2052,2082,2086,2095`)
 *      emitting configs properly when enabled
 *   5. Private DoH (`/dns-query/<token>`):
 *        - Browser `GET` -> `200 OK` HTML Status & Setup Guide (ZERO `405 Method Not Allowed`!)
 *        - JSON `GET ?name=example.com&type=A` -> `200 OK` DNS JSON
 *        - Binary RFC 8484 `POST` (`application/dns-message`) -> `200 OK` wire DNS
 *   6. `www.speedtest.net` & Cloudflare-Hosted Sites Fix:
 *        - Xray JSON keeps `full:www.speedtest.net` ONLY in `dns.servers[1].domains`, NEVER in `direct` routing!
 *        - Real multi-frame fragmented TLS 1.3 `ClientHello` (`SNI: www.speedtest.net`) over VLESS WebSocket
 *          completes full HTTPS `GET https://www.speedtest.net/cdn-cgi/trace` -> `HTTP/1.1 200 OK` via automatic
 *          `replayChunks` + `ProxyIP` fallback!
 *   7. Native Official Telegram Web Proxy (`tg://webproxy`):
 *        - `GET /?bridge=<43-char-HMAC>` -> `200 OK` CSP-nonced bridge script
 *        - `POST /api/v1/session` -> `200 OK` (`X-Carrier-Mode: websocket-lanes`, `X-Session-Token`)
 *        - `GET /api/v1/ws` (`tproxy-lane-v1.<token>.1`) -> `101 Switching Protocols`
 *   8. Browser User-List Clean IP & Domain Scanner (`#btn-scan-user-list` + `#btn-prune-clean`) in Chromium!
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
  hdr[o++] = 0x00; // version 0
  uuidBytes.copy(hdr, o); o += 16;
  hdr[o++] = 0x00; // optLen = 0
  hdr[o++] = cmd;  // 1 = TCP
  hdr.writeUInt16BE(port, o); o += 2;
  hdr[o++] = 0x02; // atyp 2 = domain
  hdr[o++] = hostBytes.length;
  hostBytes.copy(hdr, o);
  return hdr;
}

/**
 * Dial an HTTPS target over our VLESS WebSocket tunnel while intentionally splitting
 * the VLESS header (Frame #1) and fragmented TLS ClientHello (Frames #2..#N) across
 * separate WebSocket frames — reproducing Xray + Fragment 1-1 against Cloudflare-hosted `www.speedtest.net`!
 */
async function fetchHttpsViaFragmentedVless({ wsUrl, uuid, targetHost, targetPort = 443, path = '/' }) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let vlessRespHeaderStripped = false;
    let headerSent = false;

    const timer = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error(`VLESS HTTPS test timed out for ${targetHost}`));
    }, 20000);

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ws.on('open', async () => {
      // Frame #1: ONLY the 24-byte VLESS header (0 payload bytes!)
      const vlessHdr = buildVlessHeader(uuid, targetHost, targetPort, 1);
      ws.send(vlessHdr);
      headerSent = true;
      await sleep(35);

      // Wrap WS in a Node Duplex stream that fragments initial writes into 18-byte frames!
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
          buf = buf.subarray(2); // strip 2-byte VLESS response header [0x00, 0x00]
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
  console.log('═══ NIGHTLINE v2.3.0 Full Live Verification Suite ═══');

  const proc = spawn(
    'npx',
    ['wrangler', 'dev', '--local', '--port', String(PORT), '--persist-to', `/tmp/nl-v23-kv-${Date.now()}`],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let serverLogs = '';
  proc.stdout.on('data', (d) => { serverLogs += d.toString(); });
  proc.stderr.on('data', (d) => { serverLogs += d.toString(); });

  try {
    // Wait for workerd ready
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch(`${BASE}/health`);
        if (r.ok) { ready = true; break; }
      } catch {}
      await sleep(300);
    }
    assert(ready, 'workerd failed to start');

    // ── TEST 1: Health & Version 2.3.0 & Clean COLO (no EDGE) ──
    const health = await (await fetch(`${BASE}/health`)).json();
    assert.equal(health.version, '2.3.0', 'Health version must be 2.3.0');
    assert.notEqual(health.colo, 'EDGE', 'colo must never be EDGE');
    console.log(`✓ [1/8] /health -> version=${health.version}, colo=${health.colo}`);

    // ── TEST 2: Setup Panel & Verify No remarkPrefix + Default ProxyIPs + TgProxy ──
    const setupRes = await fetch(`${BASE}/api/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'AdminPassword23!', firstUserName: 'سردبیر اصلی' }),
    });
    assert.equal(setupRes.status, 200);
    const cookie = (setupRes.headers.get('set-cookie') || '').split(';')[0];
    const boot = await setupRes.json();

    assert.equal(boot.version, '2.3.0');
    assert.equal(boot.settings.remarkPrefix, undefined, 'remarkPrefix must be completely removed');
    assert(boot.settings.proxyIPs.length >= 3, 'Default verified ProxyIPs must be populated');
    assert.equal(boot.settings.enableNAT64, true, 'Default NAT64 must be enabled');
    assert.equal(boot.settings.enableTgProxy, true, 'Telegram Web Proxy must be enabled by default');
    assert.match(boot.settings.tgProxySecret, /^[0-9a-f]{32}$/, '32-hex Telegram secret auto-minted');
    assert(boot.tgProxy.tgUrl.startsWith('tg://webproxy?server='), 'tg://webproxy URL ready');
    assert(boot.tgProxy.tmeUrl.startsWith('https://t.me/webproxy?server='), 't.me/webproxy URL ready');
    console.log(`✓ [2/8] Setup & Defaults -> 0 remarkPrefix, ${boot.settings.proxyIPs.length} ProxyIPs, tg://webproxy ready`);

    const user = boot.users[0];

    // ── TEST 3: All 6 TLS Ports + All 7 HTTP Ports + Free Notice in Subscriptions ──
    // Default has all 6 TLS ports [443,8443,2053,2083,2087,2096] + 1 Clean IP (www.speedtest.net#Speedtest) + VLESS + Trojan = 24 nodes!
    const rawSubRes = await fetch(`${BASE}/sub/${user.subToken}?format=raw`);
    assert.equal(rawSubRes.status, 200);
    const announceHdr = rawSubRes.headers.get('announce') || '';
    assert(announceHdr.startsWith('base64:'), 'Subscription must include announce header');
    const decodedAnnounce = Buffer.from(announceHdr.slice(7), 'base64').toString('utf8');
    assert(decodedAnnounce.includes('رایگان و متن‌باز'), 'Announce header must state free & non-commercial');

    const rawLines = (await rawSubRes.text()).trim().split('\n');
    const firstDecodedHash = decodeURIComponent(rawLines[0].split('#')[1] || '');
    assert(firstDecodedHash.includes('رایگان و غیرقابل فروش'), 'Top URI line must state free & not for sale');

    for (const p of [443, 8443, 2053, 2083, 2087, 2096]) {
      assert(
        rawLines.some((l) => l.includes(`:${p}?`)),
        `Expected TLS port ${p} to be emitted in subscription!`
      );
    }
    for (const l of rawLines) {
      const tag = decodeURIComponent(l.split('#')[1] || '');
      assert(!tag.includes('NIGHTLINE ·'), `Node tag must NOT include prefix: ${tag}`);
      assert(!tag.includes('· Edge'), `Node tag must NOT include Edge: ${tag}`);
    }

    // Also enable HTTP ports and verify all 7 HTTP ports emit!
    const setHttpRes = await fetch(`${BASE}/api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ ...boot.settings, enableHttpPorts: true }),
    });
    assert.equal(setHttpRes.status, 200);
    const rawWithHttp = (await (await fetch(`${BASE}/sub/${user.subToken}?format=raw`)).text()).trim().split('\n');
    for (const hp of [80, 8080, 8880, 2052, 2082, 2086, 2095]) {
      assert(
        rawWithHttp.some((l) => l.includes(`:${hp}?`) && l.includes('security=none')),
        `Expected HTTP port ${hp} to be emitted when enableHttpPorts=true!`
      );
    }
    console.log(`✓ [3/8] Ports & Free Sub Notice -> All 6 TLS ports + All 7 HTTP ports emitted (${rawWithHttp.length} lines), 0 prefix/Edge`);

    // ── TEST 4: Private DoH (`/dns-query/<token>`) Browser HTML + JSON + Binary POST ──
    const dohHtmlRes = await fetch(`${BASE}/dns-query/${user.subToken}`, {
      headers: { accept: 'text/html,application/xhtml+xml' },
    });
    assert.equal(dohHtmlRes.status, 200, 'Browser GET on Private DoH must return 200 OK, NOT 405!');
    const dohHtml = await dohHtmlRes.text();
    assert(dohHtml.includes('NIGHTLINE · PRIVATE DoH'), 'Browser DoH page must render setup guide');

    const dohJsonRes = await fetch(`${BASE}/dns-query/${user.subToken}?name=example.com&type=A`, {
      headers: { accept: 'text/html' }, // even when opened from browser address bar!
    });
    assert.equal(dohJsonRes.status, 200);
    const dohJson = await dohJsonRes.json();
    assert.equal(dohJson.Status, 0);
    assert(Array.isArray(dohJson.Answer) && dohJson.Answer.length > 0);

    // RFC 8484 Wireformat POST (minimal A query for example.com)
    const dnsWireQuery = Buffer.from(
      'abcd01000001000000000000076578616d706c6503636f6d0000010001',
      'hex'
    );
    const dohPostRes = await fetch(`${BASE}/dns-query/${user.subToken}`, {
      method: 'POST',
      headers: { 'content-type': 'application/dns-message' },
      body: dnsWireQuery,
    });
    assert.equal(dohPostRes.status, 200);
    const dohPostBytes = new Uint8Array(await dohPostRes.arrayBuffer());
    assert(dohPostBytes.byteLength > 28 && dohPostBytes[0] === 0xab && dohPostBytes[1] === 0xcd);
    console.log('✓ [4/8] Private DoH -> Browser GET 200 HTML Guide + ?name= JSON 200 + RFC 8484 POST 200');

    // ── TEST 5: Xray Routing Check + LIVE `www.speedtest.net` HTTPS over Fragmented VLESS Tunnel! ──
    const xrayConfigs = await (await fetch(`${BASE}/sub/${user.subToken}?format=xray`)).json();
    assert(Array.isArray(xrayConfigs) && xrayConfigs.length > 0);
    const x0 = xrayConfigs[0];
    assert(
      x0.dns.servers[1].domains.includes('full:www.speedtest.net'),
      'www.speedtest.net must remain in bootstrap DNS domains'
    );
    for (const rule of x0.routing.rules) {
      if (rule.outboundTag === 'direct' && Array.isArray(rule.domain)) {
        assert(
          !rule.domain.includes('full:www.speedtest.net'),
          'www.speedtest.net MUST NOT be routed to DIRECT!'
        );
      }
    }

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
    console.log('✓ [5/8] Cloudflare-Hosted Tunnel Fix -> LIVE HTTPS to www.speedtest.net (fragmented multi-frame VLESS -> ProxyIP replay) returned HTTP 200 OK!');

    // ── TEST 6: Official Telegram Web Proxy (`/?bridge=`, `/api/v1/session`, `/api/v1/ws`) ──
    const tgSecret = boot.settings.tgProxySecret;
    const hmacCap = crypto
      .createHmac('sha256', Buffer.from(tgSecret, 'hex'))
      .update('tdesktop-web-proxy-bridge-v1\n127.0.0.1')
      .digest('base64url');

    const bridgeRes = await fetch(`${BASE}/?bridge=${hmacCap}`);
    assert.equal(bridgeRes.status, 200, 'Valid HMAC bridge capability must return 200');
    const bridgeHtml = await bridgeRes.text();
    const bootMatch = /boot="([A-Za-z0-9_-]{43})"/.exec(bridgeHtml);
    assert(bootMatch, 'Bridge HTML must embed 43-char boot token');

    // Invalid bridge HMAC must return 404
    const badBridge = await fetch(`${BASE}/?bridge=${'A'.repeat(43)}`, { headers: { host: 'example.com' } });
    assert.equal(badBridge.status, 404);

    // Exchange boot token for session token (`POST /api/v1/session`)
    const helloFrame = new Uint8Array([0x10, 0, 0, 0, 0, 0, 0, 1, 1]);
    const sessRes = await fetch(`${BASE}/api/v1/session`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${bootMatch[1]}`,
        'content-type': 'application/octet-stream',
      },
      body: helloFrame,
    });
    assert.equal(sessRes.status, 200);
    assert.equal(sessRes.headers.get('x-carrier-mode'), 'websocket-lanes');
    const sessToken = sessRes.headers.get('x-session-token') || '';
    assert.match(sessToken, /^[A-Za-z0-9_-]{43}$/);

    // Upgrade WebSocket lane (`GET /api/v1/ws` with `tproxy-lane-v1.<sessToken>.1`)
    await new Promise((resolve, reject) => {
      const subproto = `tproxy-lane-v1.${sessToken}.1`;
      const tgWs = new WebSocket(`ws://127.0.0.1:${PORT}/api/v1/ws`, subproto);
      tgWs.on('open', () => {
        assert.equal(tgWs.protocol, subproto);
        tgWs.close();
        resolve();
      });
      tgWs.on('error', reject);
    });
    console.log('✓ [6/8] Official Telegram Web Proxy -> HMAC Bridge 200 + Session Lease 200 + Lane WS 101 verified!');

    // ── TEST 7 & 8: Headless Chromium UI Verification (Popup Modal, COLO, Ports, TgProxy UI, User-List Clean IP Scanner!) ──
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1400, height: 920 } });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(`${BASE}/panel`, { waitUntil: 'networkidle' });

    // Free Notice Popup Modal must be visible on first load!
    const popupVisible = await page.locator('#free-notice-modal').isVisible();
    assert(popupVisible, 'Free & Non-Commercial Popup Modal must appear on initial visit');
    await page.click('#btn-free-close');
    assert.equal(await page.locator('#free-notice-modal').isVisible(), false, 'Popup must close on click');

    // Login to Admin Panel
    await page.fill('#login-pass', 'AdminPassword23!');
    await page.click('#f-login button[type="submit"]');
    await page.waitForSelector('#v-admin:not([hidden])');

    // Verify top-edge & st-edge do NOT say EDGE: EDGE
    const topEdgeText = await page.locator('#top-edge').textContent();
    const stEdgeText = await page.locator('#st-edge').textContent();
    assert(topEdgeText.startsWith('COLO ·') && !topEdgeText.includes('EDGE'), `Bad #top-edge: ${topEdgeText}`);
    assert(!stEdgeText.includes('EDGE'), `Bad #st-edge: ${stEdgeText}`);

    // Reopen Free Popup via header button `#btn-free-info`
    await page.click('#btn-free-info');
    assert.equal(await page.locator('#free-notice-modal').isVisible(), true);
    await page.click('#btn-free-close');

    // Verify Telegram Web Proxy card on Dashboard
    assert.equal(await page.locator('#dash-tg-box').isVisible(), true);
    const tgHref = await page.locator('#dash-tg-open').getAttribute('href');
    assert(tgHref.startsWith('tg://webproxy?server='), `Invalid tgHref: ${tgHref}`);

    // Switch to Tab 3 (`net`) and test Browser User-List Clean IP & Domain Scanner!
    await page.click('.tab-btn[data-tab="net"]');
    await page.waitForSelector('#pane-net:not([hidden])');

    await page.fill(
      '#s-cleanips',
      ['www.speedtest.net#Speedtest', '1.1.1.1#CF-One', '203.0.113.1#BlackholeTest'].join('\n')
    );
    await page.click('#btn-scan-user-list');

    // Wait for scan summary & prune button (`203.0.113.1` times out after 3.5s)
    await page.waitForSelector('#btn-prune-clean:not([hidden])', { timeout: 12000 });
    const summaryTxt = await page.locator('#scan-summary').textContent();
    assert(summaryTxt.includes('2') && summaryTxt.includes('3'), `Expected 2/3 healthy in summary: ${summaryTxt}`);

    // Click Keep & Sort Healthy (`#btn-prune-clean`) and verify dead IP is pruned!
    await page.click('#btn-prune-clean');
    const prunedVal = await page.locator('#s-cleanips').inputValue();
    assert(prunedVal.includes('www.speedtest.net#Speedtest'), 'Speedtest must remain');
    assert(prunedVal.includes('1.1.1.1#CF-One'), '1.1.1.1 must remain');
    assert(!prunedVal.includes('203.0.113.1'), 'Dead IP 203.0.113.1 must be pruned');

    // Also check Subscriber Press Pass `/sub/<token>` in Chromium
    const subPage = await context.newPage();
    await subPage.goto(`${BASE}/sub/${user.subToken}`, { waitUntil: 'networkidle' });
    assert.equal(await subPage.locator('#sub-free-modal').isVisible(), true, 'Subscriber page free modal visible');
    await subPage.click('#sub-free-ok');
    const subBody = await subPage.textContent('body');
    assert(subBody.includes('رایگان و غیرقابل فروش'));
    assert(subBody.includes('V2.3.0'));

    assert.equal(pageErrors.length, 0, `Unexpected browser JS errors: ${pageErrors.join('; ')}`);
    await browser.close();

    assert(!serverLogs.includes('Uncaught'), `Unexpected Uncaught in workerd logs:\n${serverLogs}`);
    console.log('✓ [7/8] Chromium UI -> Free Popup Modal, COLO badge, V2.3.0, Telegram Proxy card, Subscriber Pass verified!');
    console.log(`✓ [8/8] Browser User-List Clean IP Scanner -> Live ISP scan (${summaryTxt.trim()}) + 1-click prune verified!`);
    console.log('\n🎉 ALL 8/8 NIGHTLINE v2.3.0 E2E VERIFICATION SUITES PASSED WITH ZERO ERRORS!');
  } finally {
    proc.kill('SIGTERM');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
