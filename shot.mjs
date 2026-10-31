#!/usr/bin/env node
/**
 * NIGHTLINE v2.4.0 — Automated Screenshot Generator for GitHub Documentation (`docs/screenshots/`)
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright';

const OUT_DIR = 'docs/screenshots';
fs.mkdirSync(OUT_DIR, { recursive: true });

const PORT = 19420 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(
  'npx',
  ['wrangler', 'dev', '--local', '--port', String(PORT), '--persist-to', `/tmp/nl-shot-kv-${Date.now()}`],
  { stdio: 'ignore' }
);

try {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) break;
    } catch {}
    await sleep(300);
  }

  const setupRes = await fetch(`${BASE}/api/setup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: 'DemoPassword2026!', firstUserName: 'سردبیر (اصلی)' }),
  });
  const cookie = (setupRes.headers.get('set-cookie') || '').split(';')[0];

  await fetch(`${BASE}/api/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      name: 'کاربر موبایل — همراه اول',
      note: 'شروع با اولین اتصال',
      trafficLimitGB: 50,
      expiryDays: 30,
      startOnFirstUse: true,
    }),
  });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1360, height: 920 }, deviceScaleFactor: 1.5 });
  await context.route('https://speed.cloudflare.com/meta', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        clientIp: '198.51.100.42',
        country: 'IR',
        city: 'Tehran',
        asn: 197207,
        asOrganization: 'Mobile Communication Company of Iran PLC',
        colo: 'FRA',
      }),
    });
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/panel`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(450);

  // 1) Free & Non-Commercial Popup Modal screenshot
  await page.screenshot({ path: `${OUT_DIR}/06-free-notice-popup.png` });
  await page.click('#btn-free-close');

  // Login
  await page.fill('#login-pass', 'DemoPassword2026!');
  await page.click('#f-login button[type="submit"]');
  await page.waitForSelector('#v-admin:not([hidden])');
  await page.click('#btn-speed-burst');
  await page.waitForTimeout(900);

  // 2) Dashboard (FA Light) — with Visitor IP/ISP Blur Strip + Live Monochrome Chart!
  await page.screenshot({ path: `${OUT_DIR}/01-dashboard-light-fa.png`, fullPage: true });

  // 3) Dashboard (EN Dark) — with IP Blurred + Subscriber Usage Hatched Bar Chart!
  await page.click('#lang');
  await page.click('.t-pick[data-th="dark"]');
  await page.click('#btn-ip-blur');
  await page.click('#chart-mode-usage');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT_DIR}/02-dashboard-dark-en.png`, fullPage: true });

  // Restore FA Light & capture Smart ISP Advisor (`03-smart-isp-advisor.png` + `03-network-scanner-tgproxy.png`)
  await page.click('#lang');
  await page.click('.t-pick[data-th="light"]');
  await page.click('#btn-ip-blur');

  await page.click('.tab-btn[data-tab="advisor"]');
  await page.waitForSelector('#pane-advisor:not([hidden])');
  await page.click('#btn-adv-run');
  await page.waitForSelector('#btn-adv-apply:not([hidden])', { timeout: 15000 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT_DIR}/07-smart-isp-advisor.png`, fullPage: true });

  await page.click('.tab-btn[data-tab="net"]');
  await page.waitForSelector('#pane-net:not([hidden])');
  await page.fill(
    '#s-cleanips',
    ['www.speedtest.net#Speedtest', 'cp.cloudflare.com#CF-Captive', '1.1.1.1#CF-One'].join('\n')
  );
  await page.click('#btn-scan-user-list');
  await page.waitForSelector('#btn-prune-clean:not([hidden])', { timeout: 10000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT_DIR}/03-network-scanner-tgproxy.png`, fullPage: true });

  // 4) Subscriber Press Pass (/sub/<token>)
  await page.click('.tab-btn[data-tab="sub"]');
  const subHref = await page.getAttribute('#open-pass', 'href');
  const subToken = subHref.split('/sub/')[1];

  const subPage = await context.newPage();
  await subPage.goto(`${BASE}/sub/${subToken}`, { waitUntil: 'networkidle' });
  await subPage.click('#sub-free-ok');
  await subPage.waitForTimeout(350);
  await subPage.screenshot({ path: `${OUT_DIR}/04-subscriber-press-pass.png`, fullPage: true });

  // 5) Private DoH Guide (/dns-query/<token>)
  const dohPage = await context.newPage();
  await dohPage.goto(`${BASE}/dns-query/${subToken}`, { waitUntil: 'networkidle' });
  await dohPage.waitForTimeout(300);
  await dohPage.screenshot({ path: `${OUT_DIR}/05-private-doh-guide.png`, fullPage: true });

  await browser.close();
  console.log('✓ Generated all 7 high-resolution v2.4.0 screenshots in docs/screenshots/');
} finally {
  proc.kill('SIGTERM');
  process.exit(0);
}
