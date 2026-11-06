/* NIGHTLINE v2.5.8 — Complete Client Application (Vanilla ES6, zero external deps, zero emojis) */
(function () {
  'use strict';

  var OFFICIAL_GITHUB_REPO = 'MrIranMa/panel';
  var OFFICIAL_GITHUB_URL = 'https://github.com/MrIranMa/panel';

  var $ = function (id) { return document.getElementById(id); };
  var html = document.documentElement;

  var LS = {
    get: function (k) { try { return localStorage.getItem('nl.' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('nl.' + k, v); } catch (e) {} }
  };

  var lang = LS.get('lang') === 'en' ? 'en' : 'fa';
  var theme = LS.get('theme') === 'dark' ? 'dark' : 'light';
  var ipBlurred = LS.get('ipblur') === '1';

  var COUNTRY_NAMES = {
    IR: ['ایران', 'Iran'],
    NL: ['هلند', 'Netherlands'],
    DE: ['آلمان', 'Germany'],
    US: ['آمریکا', 'United States'],
    GB: ['بریتانیا', 'United Kingdom'],
    FR: ['فرانسه', 'France'],
    TR: ['ترکیه', 'Turkey'],
    AE: ['امارات', 'UAE'],
    FI: ['فنلاند', 'Finland'],
    SE: ['سوئد', 'Sweden'],
    CA: ['کانادا', 'Canada'],
    SG: ['سنگاپور', 'Singapore'],
    JP: ['ژاپن', 'Japan'],
    RU: ['روسیه', 'Russia'],
    CN: ['چین', 'China']
  };

  var ISP_LOCAL_MAP = [
    [/mobile communication|mci|hamrah/i, 'همراه اول (MCI)', 'MCI (Hamrah Aval)'],
    [/irancell|mtn/i, 'ایرانسل (MTN Irancell)', 'MTN Irancell'],
    [/iran telecommunication|tci|mkh/i, 'مخابرات ایران (TCI)', 'TCI (Telecom Iran)'],
    [/rightel/i, 'رایتل (Rightel)', 'Rightel'],
    [/shatel/i, 'شاتل (Shatel)', 'Shatel'],
    [/asiatech/i, 'آسیاتک (Asiatech)', 'Asiatech'],
    [/mobinnet/i, 'مبین‌نت (Mobinnet)', 'Mobinnet'],
    [/hiweb/i, 'های‌وب (HiWEB)', 'HiWEB'],
    [/pars online|parsonline/i, 'پارس‌آنلاین (ParsOnline)', 'ParsOnline'],
    [/zitel/i, 'زیتل (Zitel)', 'Zitel'],
    [/pishgaman/i, 'پیشگامان (Pishgaman)', 'Pishgaman'],
    [/afranet/i, 'افرانت (Afranet)', 'Afranet'],
    [/respina/i, 'رسپینا (Respina)', 'Respina'],
    [/hetzner/i, 'هتزنر (Hetzner)', 'Hetzner Online'],
    [/cloudflare/i, 'کلادفلر (Cloudflare)', 'Cloudflare Net']
  ];

  var STATE = {
    mode: 'loading',
    isDemo: false,
    host: location.host || 'arenapanel.workers.dev',
    edge: '—',
    cf: {
      clientIp: '—',
      country: 'XX',
      countryNameFa: 'در حال تشخیص…',
      countryNameEn: 'Detecting…',
      city: '',
      asn: 0,
      ispRaw: '',
      ispFa: 'در حال شناسایی…',
      ispEn: 'Detecting ISP…',
      colo: '—'
    },
    settings: null,
    cfIntegration: null,
    cfUsage: null,
    ghInfo: null,
    users: [],
    logs: [],
    selectedUserId: '',
    currentNodes: [],
    currentQrText: '',
    currentQrCaption: 'SUBSCRIPTION'
  };

  /* ------------------------------------------------- Helpers & Typography */

  function computeUserTrafficPercent(u, allUsers) {
    var used = Math.max(0, Number(u && u.usedBytes) || 0);
    if (used <= 0) return 0;
    var limit = Math.max(0, Number(u && u.limitBytes) || 0);
    if (limit > 0) {
      return Math.min(100, Math.max(1, Math.round((used / limit) * 100)));
    }
    var refMax = 50 * 1073741824; // 50 GB reference scale for unlimited accounts with >0 traffic
    if (Array.isArray(allUsers)) {
      allUsers.forEach(function (x) {
        if ((x.usedBytes || 0) > refMax) refMax = x.usedBytes;
      });
    }
    return Math.min(100, Math.max(1, Math.round((used / refMax) * 100)));
  }

  function formatCompactCount(n) {
    var v = Math.max(0, Number(n) || 0);
    if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(v));
  }

  function tr(fa, en) {
    return lang === 'fa' ? fa : en;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function svgIcon(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }

  function formatBytes(b) {
    var n = Number(b) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }

  function uuid4() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.from(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  function randPass(len) {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    var b = new Uint8Array(len || 14);
    crypto.getRandomValues(b);
    var s = '';
    for (var i = 0; i < b.length; i++) s += chars[b[i] % chars.length];
    return s;
  }

  function randHex(bytesLen) {
    var arr = new Uint8Array(bytesLen);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(arr);
    else for (var i = 0; i < bytesLen; i++) arr[i] = Math.floor(Math.random() * 256);
    var out = '';
    for (var j = 0; j < arr.length; j++) out += arr[j].toString(16).padStart(2, '0');
    return out;
  }

  /* ------------------ Tactile Stationary-Shadow Button Press Physics */

  document.addEventListener('pointerdown', function (ev) {
    var btn = ev.target && ev.target.closest ? ev.target.closest('.btn, .mini, .tab-btn, .blur-btn') : null;
    if (!btn || btn.disabled) return;
    btn.classList.add('is-pressed');
    var clear = function () {
      setTimeout(function () { btn.classList.remove('is-pressed'); }, 95);
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
  }, { passive: true });

  var toastTimer = null;
  function showToast(fa, en) {
    try {
      var el = $('toast');
      if (!el) return;
      el.textContent = tr(fa, en);
      el.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { el.hidden = true; }, 2800);
    } catch (e) {}
  }

  window.addEventListener('error', function (ev) {
    try {
      var msg = (ev && ev.error && ev.error.message) || (ev && ev.message) || '';
      if (msg && msg.indexOf('ResizeObserver') === -1) {
        showToast('خطای غیرمنتظره مهار شد: ' + msg, 'Handled UI error: ' + msg);
      }
    } catch (e) {}
  });

  window.addEventListener('unhandledrejection', function (ev) {
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    try {
      var reason = ev && ev.reason;
      var msg = reason && reason.message ? reason.message : String(reason || 'خطای شبکه');
      showToast(msg, msg);
    } catch (e) {}
  });

  function copyText(str, labelFa, labelEn) {
    if (!str) return;
    var done = function () {
      showToast((labelFa || 'لینک') + ' رونوشت شد', (labelEn || 'Copied') + ' — OK');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = str;
      ta.style.position = 'fixed';
      ta.style.top = '-999px';
      document.body.appendChild(ta);
      ta.select();
      try { if(document.execCommand('copy'))done();else window.prompt(tr('کپی خودکار نشد؛ لینک را دستی کپی کنید:','Automatic copy failed; copy this link manually:'),str); } catch (e) {window.prompt(tr('لینک را دستی کپی کنید:','Copy this link manually:'),str);}
      document.body.removeChild(ta);
    }
  }

  function drawQrInto(boxId, text) {
    var box = $(boxId);
    if (!box || !text || typeof qrcode !== 'function') return;
    try {
      var curTh = html.getAttribute('data-theme');
      var bg = curTh === 'dark' ? '#efeadd' : '#ffffff';
      var fg = '#15130f';
      var qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 2, margin: 4, scalable: true });
      var svg = box.querySelector('svg');
      if (svg) {
        svg.setAttribute('width', '152');
        svg.setAttribute('height', '152');
        svg.setAttribute('shape-rendering', 'crispEdges');
        svg.querySelectorAll('rect').forEach(function (r) { r.setAttribute('fill', bg); });
        svg.querySelectorAll('path').forEach(function (p) { p.setAttribute('fill', fg); });
      }
    } catch (e) {
      box.innerHTML = '';
    }
  }

  /* ----------------------- Visitor Connection Identity & IP Blur Strip */

  function classifyLocalIsp(raw) {
    var s = String(raw || '').trim();
    if (!s) return null;
    for (var i = 0; i < ISP_LOCAL_MAP.length; i++) {
      if (ISP_LOCAL_MAP[i][0].test(s)) {
        return { fa: ISP_LOCAL_MAP[i][1], en: ISP_LOCAL_MAP[i][2] };
      }
    }
    return { fa: s, en: s };
  }

  function mergeVisitorCf(cfObj) {
    if (!cfObj || typeof cfObj !== 'object') return;
    var c = STATE.cf;
    var incomingIp = String(cfObj.clientIp || '');
    var incomingIsLoop = !incomingIp || incomingIp === '0.0.0.0' || incomingIp === '127.0.0.1' || incomingIp === '::1';
    var currentHasPublicIp = c.clientIp && c.clientIp !== '—' && c.clientIp !== '127.0.0.1' && c.clientIp !== '::1';

    if (incomingIp && (!incomingIsLoop || !currentHasPublicIp)) {
      c.clientIp = incomingIp;
    }
    if (cfObj.country && cfObj.country !== 'XX') {
      c.country = String(cfObj.country).toUpperCase();
      var pair = COUNTRY_NAMES[c.country];
      c.countryNameFa = cfObj.countryNameFa || (pair ? pair[0] : c.country);
      c.countryNameEn = cfObj.countryNameEn || (pair ? pair[1] : c.country);
    } else if (cfObj.countryNameFa && c.country === 'XX') {
      c.countryNameFa = cfObj.countryNameFa;
      c.countryNameEn = cfObj.countryNameEn || 'Local';
    }
    if (cfObj.city) c.city = cfObj.city;
    if (cfObj.asn) c.asn = Number(cfObj.asn) || 0;

    var genericIsp = !cfObj.ispFa || cfObj.ispFa === 'نامشخص' || cfObj.ispFa.indexOf('شبکه محلی') === 0;
    var currentHasRealIsp = c.ispFa && c.ispFa !== 'در حال شناسایی…' && c.ispFa.indexOf('شبکه محلی') !== 0;

    if (cfObj.ispRaw) {
      c.ispRaw = cfObj.ispRaw;
      var mapped = classifyLocalIsp(cfObj.ispRaw);
      if (mapped) { c.ispFa = mapped.fa; c.ispEn = mapped.en; }
    } else if (!genericIsp || !currentHasRealIsp) {
      if (cfObj.ispFa) c.ispFa = cfObj.ispFa;
      if (cfObj.ispEn) c.ispEn = cfObj.ispEn;
    }

    if (cfObj.colo && cfObj.colo !== '—' && (cfObj.colo !== 'CF-GLOBAL' || c.colo === '—')) {
      c.colo = cfObj.colo;
      STATE.edge = cfObj.colo;
    }
    renderVisitorStrip();
  }

  function renderVisitorStrip() {
    var c = STATE.cf;
    var ipEl = $('visitor-ip');
    var blurBtn = $('btn-ip-blur');
    var blurLbl = $('ip-blur-lbl');
    var blurIcon = $('ip-blur-icon');

    if (ipEl) {
      ipEl.textContent = c.clientIp || '—';
      ipEl.classList.toggle('is-blurred', ipBlurred);
    }
    if (blurBtn) blurBtn.classList.toggle('active', ipBlurred);
    if (blurLbl) blurLbl.textContent = ipBlurred ? 'SHOW' : 'BLUR';
    if (blurIcon) blurIcon.innerHTML = '<use href="#i-' + (ipBlurred ? 'eye' : 'eye-off') + '"/>';

    if ($('visitor-country')) {
      var locStr = tr(c.countryNameFa || 'محلی', c.countryNameEn || 'Local');
      if (c.city) locStr += ' · ' + c.city;
      $('visitor-country').textContent = locStr;
    }
    if ($('visitor-iso')) {
      $('visitor-iso').textContent = (c.country && c.country !== 'XX') ? c.country : 'LOCAL';
    }
    if ($('visitor-isp')) {
      $('visitor-isp').textContent = tr(c.ispFa || 'شبکهٔ محلی', c.ispEn || 'Local Network');
    }
    if ($('visitor-asn')) {
      $('visitor-asn').textContent = c.asn ? ('AS' + c.asn) : '';
    }
    if ($('visitor-colo')) {
      $('visitor-colo').textContent = 'COLO · ' + (c.colo || STATE.edge || '—');
    }
    if ($('top-edge')) {
      $('top-edge').textContent = 'COLO · ' + (STATE.edge || '—');
    }
  }

  if ($('btn-ip-blur')) {
    $('btn-ip-blur').addEventListener('click', function () {
      ipBlurred = !ipBlurred;
      LS.set('ipblur', ipBlurred ? '1' : '0');
      renderVisitorStrip();
    });
  }

  async function detectVisitorNetwork() {
    if (isSandboxPreview) {
      mergeVisitorCf({
        clientIp: '5.160.214.88',
        country: 'IR',
        countryNameFa: 'ایران',
        countryNameEn: 'Iran',
        city: 'Tehran',
        asn: 44244,
        ispFa: 'ایرانسل (MTN Irancell)',
        ispEn: 'MTN Irancell',
        colo: 'FRA'
      });
      pushTelemetrySample(46, 18.4);
      return;
    }

    // 1) Query Worker's own /api/client-info and measure true Worker RTT
    try {
      var t0 = performance.now();
      var r = await fetch('/api/client-info?_=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' });
      var rtt = Math.max(1, Math.round(performance.now() - t0));
      if (r.ok) {
        var j = await r.json();
        if (j && j.cf) mergeVisitorCf(j.cf);
        pushTelemetrySample(rtt, null);
      }
    } catch (e) {}

    // 2) If running on local dev / loopback where Worker sees 127.0.0.1 or XX, try Cloudflare speed meta from browser
    var curIp = STATE.cf.clientIp;
    if (!curIp || curIp === '—' || curIp === '127.0.0.1' || curIp === '::1' || STATE.cf.country === 'XX') {
      try {
        var ctrl = new AbortController();
        var tid = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 3200);
        var res = await fetch('https://speed.cloudflare.com/meta', { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(tid);
        if (res.ok) {
          var meta = await res.json();
          if (meta && meta.clientIp) {
            mergeVisitorCf({
              clientIp: meta.clientIp,
              country: meta.country || 'XX',
              city: meta.city || '',
              asn: meta.asn || 0,
              ispRaw: meta.asOrganization || '',
              colo: meta.colo || STATE.edge
            });
          }
        }
      } catch (e) {
        if (STATE.cf.clientIp === '127.0.0.1' || STATE.cf.clientIp === '::1') {
          STATE.cf.countryNameFa = 'محیط محلی (Local)';
          STATE.cf.countryNameEn = 'Local Sandbox';
          STATE.cf.ispFa = 'شبکهٔ محلی (Loopback)';
          STATE.cf.ispEn = 'Local Loopback';
          renderVisitorStrip();
        }
      }
    }
  }

  /* ------------ Dynamic Theme-Native Monochrome Animated Telemetry Chart */

  var chartMode = 'live'; // 'live' | 'usage'
  var rttHistory = [];
  var speedHistory = [];
  var MAX_POINTS = 36;
  var chartAnimPhase = 0;
  var usageAnimProgress = 1;
  var lastMeasuredMbps = 0;
  var speedBurstRunning = false;

  function pushTelemetrySample(rttMs, mbpsVal) {
    if (typeof rttMs === 'number' && isFinite(rttMs)) {
      rttHistory.push(Math.max(1, Math.min(999, rttMs)));
      if (rttHistory.length > MAX_POINTS) rttHistory.shift();
    }
    if (typeof mbpsVal === 'number' && isFinite(mbpsVal)) {
      lastMeasuredMbps = mbpsVal;
      speedHistory.push(Math.max(0.2, Math.min(500, mbpsVal)));
    } else {
      // Derive subtle organic baseline throughput estimate from edge response cadence when idle
      var base = lastMeasuredMbps > 0
        ? Math.max(0.8, lastMeasuredMbps * (0.94 + Math.random() * 0.1))
        : Math.max(1.2, Math.min(45, 220 / Math.max(8, (rttMs || 40)) + (Math.random() * 1.4 - 0.7)));
      speedHistory.push(Number(base.toFixed(2)));
    }
    if (speedHistory.length > MAX_POINTS) speedHistory.shift();
    updateTelemetryKpis();
  }

  function updateTelemetryKpis() {
    var latestRtt = rttHistory.length ? rttHistory[rttHistory.length - 1] : null;
    var jitter = 0;
    if (rttHistory.length >= 2) {
      var sumDiff = 0;
      for (var i = 1; i < rttHistory.length; i++) sumDiff += Math.abs(rttHistory[i] - rttHistory[i - 1]);
      jitter = Math.round(sumDiff / (rttHistory.length - 1));
    }
    var latestSpd = speedHistory.length ? speedHistory[speedHistory.length - 1] : 0;
    var totalB = (STATE.users || []).reduce(function (acc, u) { return acc + (u.usedBytes || 0); }, 0);

    if ($('kpi-rtt')) $('kpi-rtt').textContent = latestRtt != null ? (latestRtt + ' ms') : '— ms';
    if ($('kpi-jitter')) $('kpi-jitter').textContent = rttHistory.length >= 2 ? (jitter + ' ms') : '0 ms';
    if ($('kpi-speed')) $('kpi-speed').textContent = latestSpd > 0 ? (latestSpd.toFixed(1) + ' Mbps') : '— Mbps';
    if ($('kpi-total-bw')) $('kpi-total-bw').textContent = formatBytes(totalB);
    if ($('chart-sample-lbl')) $('chart-sample-lbl').textContent = 'SAMPLES · ' + rttHistory.length;
  }

  async function runBurstSpeedProbe() {
    if (speedBurstRunning) return;
    speedBurstRunning = true;
    var ic = $('speed-burst-ic');
    if (ic) ic.classList.add('ic-spin');
    try {
      if (isSandboxPreview) {
        for (var k = 0; k < 4; k++) {
          await new Promise(function (r) { setTimeout(r, 180); });
          pushTelemetrySample(38 + Math.round(Math.random() * 14), 24 + Math.random() * 18);
        }
      } else {
        var sizes = [65536, 131072, 262144, 262144];
        for (var i = 0; i < sizes.length; i++) {
          var t0 = performance.now();
          var res = await fetch('/api/speed-probe?bytes=' + sizes[i] + '&_=' + Date.now() + '_' + i, {
            cache: 'no-store',
            credentials: 'same-origin'
          });
          var buf = await res.arrayBuffer();
          var dtSec = Math.max(0.002, (performance.now() - t0) / 1000);
          var mbps = (buf.byteLength * 8) / (dtSec * 1000000);
          var pingEst = Math.max(1, Math.round(dtSec * 350));
          pushTelemetrySample(rttHistory.length ? rttHistory[rttHistory.length - 1] : pingEst, Number(mbps.toFixed(2)));
        }
      }
      showToast('تست سرعت لبه انجام شد', 'Edge burst speed test complete');
    } catch (e) {
      showToast('خطا در تست سرعت لبه', 'Speed probe failed');
    }
    speedBurstRunning = false;
    if (ic) ic.classList.remove('ic-spin');
  }

  if ($('btn-speed-burst')) {
    $('btn-speed-burst').addEventListener('click', function () {
      setChartMode('live');
      runBurstSpeedProbe();
    });
  }

  function setChartMode(mode) {
    chartMode = mode === 'usage' ? 'usage' : 'live';
    if ($('chart-mode-live')) $('chart-mode-live').classList.toggle('active', chartMode === 'live');
    if ($('chart-mode-usage')) $('chart-mode-usage').classList.toggle('active', chartMode === 'usage');
    if ($('chart-legend-live')) $('chart-legend-live').hidden = chartMode !== 'live';
    if ($('chart-legend-usage')) $('chart-legend-usage').hidden = chartMode !== 'usage';
    if (chartMode === 'usage') {
      usageAnimProgress = 0;
    }
  }

  if ($('chart-mode-live')) $('chart-mode-live').onclick = function () { setChartMode('live'); };
  if ($('chart-mode-usage')) $('chart-mode-usage').onclick = function () { setChartMode('usage'); };

  function drawMonochromeChartFrame() {
    var canvas = $('telemetry-canvas');
    if (!canvas || STATE.mode !== 'admin' || $('pane-sub').hidden) {
      requestAnimationFrame(drawMonochromeChartFrame);
      return;
    }
    var rect = canvas.parentElement.getBoundingClientRect();
    var w = Math.max(260, Math.floor(rect.width));
    var h = Math.max(140, Math.floor(rect.height));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }

    var ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    // Strictly read current theme CSS variables — zero off-theme colors!
    var cs = getComputedStyle(html);
    var ink = (cs.getPropertyValue('--ink') || '#15130f').trim();
    var inkFaint = (cs.getPropertyValue('--ink-faint') || '#746d5f').trim();
    var paper = (cs.getPropertyValue('--paper') || '#eae4d6').trim();
    var paper2 = (cs.getPropertyValue('--paper-2') || '#e0d9c8').trim();

    ctx.fillStyle = paper2;
    ctx.fillRect(0, 0, w, h);

    // Subtle editorial horizontal & vertical ledger rules
    ctx.strokeStyle = inkFaint;
    ctx.globalAlpha = 0.24;
    ctx.lineWidth = 1;
    var padL = 46, padR = 16, padT = 16, padB = 24;
    var plotW = Math.max(60, w - padL - padR);
    var plotH = Math.max(60, h - padT - padB);

    for (var g = 0; g <= 3; g++) {
      var gy = Math.round(padT + (plotH * g) / 3) + 0.5;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(w - padR, gy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    chartAnimPhase += 0.045;

    if (chartMode === 'live') {
      // Seed initial baseline if empty so chart looks alive immediately
      if (rttHistory.length < 4) {
        for (var s0 = rttHistory.length; s0 < 12; s0++) {
          rttHistory.push(32 + Math.round(Math.sin(s0 * 0.7) * 6));
          speedHistory.push(Number((8.5 + Math.cos(s0 * 0.6) * 2.1).toFixed(2)));
        }
        updateTelemetryKpis();
      }

      var maxSpd = Math.max(10, Math.ceil(Math.max.apply(null, speedHistory) * 1.25));
      var maxRtt = Math.max(100, Math.ceil(Math.max.apply(null, rttHistory) * 1.3));

      // Y-axis editorial monospace labels
      ctx.fillStyle = inkFaint;
      ctx.font = '600 10px JBM, ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(maxSpd + 'M', padL - 6, padT + 4);
      ctx.fillText(Math.round(maxSpd / 2) + 'M', padL - 6, padT + plotH / 2 + 3);
      ctx.fillText('0', padL - 6, padT + plotH + 3);

      var n = speedHistory.length;
      var stepX = plotW / Math.max(1, MAX_POINTS - 1);
      var startX = padL + (MAX_POINTS - n) * stepX;

      // Build smooth throughput points with gentle live micro-oscillation on the tip
      var spdPts = [];
      for (var i = 0; i < n; i++) {
        var val = speedHistory[i];
        if (i === n - 1) val += Math.sin(chartAnimPhase) * (maxSpd * 0.015);
        var px = startX + i * stepX;
        var py = padT + plotH - Math.max(2, Math.min(plotH, (val / maxSpd) * plotH));
        spdPts.push([px, py]);
      }

      // Area fill with subtle newsprint ink wash + diagonal halftone hatch
      if (spdPts.length >= 2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(spdPts[0][0], padT + plotH);
        for (var p = 0; p < spdPts.length; p++) ctx.lineTo(spdPts[p][0], spdPts[p][1]);
        ctx.lineTo(spdPts[spdPts.length - 1][0], padT + plotH);
        ctx.closePath();
        ctx.clip();

        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.08;
        ctx.fillRect(padL, padT, plotW, plotH);

        ctx.strokeStyle = ink;
        ctx.globalAlpha = 0.14;
        ctx.lineWidth = 1;
        var hatchShift = (chartAnimPhase * 4) % 8;
        for (var hx = -h; hx < w + h; hx += 8) {
          ctx.beginPath();
          ctx.moveTo(hx + hatchShift, padT);
          ctx.lineTo(hx - h + hatchShift, padT + h);
          ctx.stroke();
        }
        ctx.restore();

        // Solid crisp primary trace (Throughput)
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(spdPts[0][0], spdPts[0][1]);
        for (var p2 = 1; p2 < spdPts.length; p2++) {
          var xc = (spdPts[p2 - 1][0] + spdPts[p2][0]) / 2;
          var yc = (spdPts[p2 - 1][1] + spdPts[p2][1]) / 2;
          ctx.quadraticCurveTo(spdPts[p2 - 1][0], spdPts[p2 - 1][1], xc, yc);
        }
        ctx.lineTo(spdPts[spdPts.length - 1][0], spdPts[spdPts.length - 1][1]);
        ctx.stroke();

        // Pulsing live telegraph nib at latest point
        var tip = spdPts[spdPts.length - 1];
        var pulseR = 3.5 + (Math.sin(chartAnimPhase * 1.8) + 1) * 2.2;
        ctx.strokeStyle = ink;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(tip[0], tip[1], pulseR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = ink;
        ctx.fillRect(tip[0] - 3, tip[1] - 3, 6, 6);
      }

      // Secondary dashed trace (Edge RTT ms)
      if (rttHistory.length >= 2) {
        ctx.save();
        ctx.strokeStyle = inkFaint;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        for (var rIdx = 0; rIdx < rttHistory.length; rIdx++) {
          var rx = padL + (MAX_POINTS - rttHistory.length + rIdx) * stepX;
          var ry = padT + plotH - Math.max(4, Math.min(plotH - 4, (rttHistory[rIdx] / maxRtt) * plotH));
          if (rIdx === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Bottom time axis label
      ctx.fillStyle = inkFaint;
      ctx.font = '500 9.5px JBM, ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillText('T - ' + Math.round(MAX_POINTS * 3.5) + 's', padL, h - 6);
      ctx.textAlign = 'right';
      ctx.fillText('NOW · LIVE', w - padR, h - 6);
    } else {
      // Mode B: Subscriber Usage Monochrome Hatched Bar Chart
      usageAnimProgress = Math.min(1, usageAnimProgress + 0.06);
      var ease = 1 - Math.pow(1 - usageAnimProgress, 3);
      var users = (STATE.users || []).slice(0, 6);
      if (!users.length) {
        ctx.fillStyle = inkFaint;
        ctx.font = '600 12px JBM, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('NO SUBSCRIBERS', w / 2, h / 2);
      } else {
        var maxBytes = 1073741824; // min 1 GB scale
        users.forEach(function (u) {
          var ref = Math.max(u.usedBytes || 0, u.limitBytes || 0);
          if (ref > maxBytes) maxBytes = ref;
        });

        ctx.fillStyle = inkFaint;
        ctx.font = '600 9.5px JBM, ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(formatBytes(maxBytes), padL + 8, padT + 4);
        ctx.fillText('0 B', padL + 8, padT + plotH + 3);

        var uPadL = padL + 14;
        var uPlotW = w - uPadL - padR;
        var slotW = uPlotW / users.length;
        var barW = Math.min(64, Math.max(20, slotW * 0.56));

        users.forEach(function (u, idx) {
          var bx = uPadL + idx * slotW + (slotW - barW) / 2;
          var capBytes = u.limitBytes > 0 ? u.limitBytes : maxBytes;
          var capH = Math.max(10, (capBytes / maxBytes) * plotH) * ease;
          var rawUsed = Math.max(0, Number(u.usedBytes) || 0);
          var usedRatio = rawUsed > 0 ? Math.min(1, rawUsed / Math.max(1, maxBytes)) : 0;
          var usedH = rawUsed > 0 ? Math.max(3, usedRatio * plotH) * ease : 0;

          // Quota capacity frame (dashed box)
          ctx.save();
          ctx.strokeStyle = inkFaint;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(bx, padT + plotH - capH, barW, capH);
          ctx.restore();

          // Used bytes solid + diagonal paper hatch bar (only when usedBytes > 0)
          var by = padT + plotH - usedH;
          if (usedH > 0) {
            ctx.fillStyle = ink;
            ctx.fillRect(bx, by, barW, usedH);

            ctx.save();
            ctx.beginPath();
            ctx.rect(bx + 1.5, by + 1.5, Math.max(0, barW - 3), Math.max(0, usedH - 3));
            ctx.clip();
            ctx.strokeStyle = paper;
            ctx.globalAlpha = 0.25;
            ctx.lineWidth = 1;
            for (var d = -plotH; d < barW + plotH; d += 6) {
              ctx.beginPath();
              ctx.moveTo(bx + d, by);
              ctx.lineTo(bx + d - usedH, by + usedH);
              ctx.stroke();
            }
            ctx.restore();
          }

          // Value above bar
          ctx.fillStyle = ink;
          ctx.font = '700 9.5px JBM, ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText(formatBytes(u.usedBytes || 0), bx + barW / 2, Math.max(11, by - 5));

          // Subscriber short name below axis
          var nm = String(u.name || '').slice(0, 12);
          ctx.fillStyle = inkFaint;
          ctx.font = '600 10px Vazir, JBM, sans-serif';
          ctx.fillText(nm, bx + barW / 2, h - 6);
        });
      }
    }

    ctx.restore();
    requestAnimationFrame(drawMonochromeChartFrame);
  }

  // Periodic background RTT pulse every 4s while Admin Tab 1 is open
  setInterval(function () {
    if (STATE.mode !== 'admin' || $('pane-sub').hidden || document.hidden || speedBurstRunning) return;
    if (isSandboxPreview) {
      pushTelemetrySample(40 + Math.round(Math.random() * 14), 16 + Math.random() * 6);
      return;
    }
    var t0 = performance.now();
    fetch('/api/client-info?_=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) {
        if (r.ok) pushTelemetrySample(Math.max(1, Math.round(performance.now() - t0)), null);
      })
      .catch(function () {});
  }, 4000);

  /* -------------- Smart Browser-Based ISP & Connectivity Advisor --------- */

  var ADV_TARGETS = [443,2053,2083,2087,2096,8443].map(function(port) {
    return {id:'port_'+port,name:'Worker TLS :'+port,catFa:'همین دامنهٔ پنل',catEn:'THIS WORKER',kind:'port',port:port,
      url:'https://'+location.hostname+':'+port+'/api/ping',check:'health'};
  }).concat([
    {id:'dns_cf',name:'Cloudflare DoH',catFa:'DNS رمزنگاری',catEn:'ENCRYPTED DNS',kind:'dns',url:'https://cloudflare-dns.com/dns-query?name=example.com&type=A',check:'dns'},
    {id:'dns_google',name:'Google DoH',catFa:'DNS رمزنگاری',catEn:'ENCRYPTED DNS',kind:'dns',url:'https://dns.google/resolve?name=example.com&type=A',check:'dns'},
    {id:'dns_quad9',name:'Quad9 DoH',catFa:'DNS رمزنگاری',catEn:'ENCRYPTED DNS',kind:'dns',url:'https://dns.quad9.net/dns-query?dns=AAABAAABAAAAAAAAB2V4YW1wbGUDY29tAAABAAE',check:'dns-wire'},
    {id:'core',name:'Google 204',catFa:'دسترسی پایه',catEn:'BASELINE',kind:'opaque',url:'https://www.gstatic.com/generate_204'},
    {id:'github',name:'GitHub',catFa:'دسترسی توسعه‌دهنده',catEn:'DEVELOPER ACCESS',kind:'opaque',url:'https://github.githubassets.com/favicons/favicon.svg'},
    {id:'telegram',name:'Telegram Web',catFa:'مشاهدهٔ مسیر پیام‌رسان',catEn:'MESSENGER PATH',kind:'opaque',url:'https://web.telegram.org/favicon.ico'}
  ]);
  var lastAdvisorPatch=null, advisorCompletedAt=0, advisorRunning=false, advisorController=null;
  function renderAdvisorSkeleton() {
    var grid=$('adv-grid');if(!grid||grid.children.length)return;
    ADV_TARGETS.forEach(function(t){
      var cell=document.createElement('div');cell.className='adv-item';cell.id='adv-cell-'+t.id;
      cell.innerHTML='<div class="adv-item-top"><span class="adv-item-name">'+esc(t.name)+'</span><span class="badge mono" id="adv-bdg-'+t.id+'">READY</span></div><div class="adv-item-cat"><span><span class="fa">'+esc(t.catFa)+'</span><span class="en">'+esc(t.catEn)+'</span></span><span class="mono" id="adv-ms-'+t.id+'">—</span></div><div class="adv-bar"><i id="adv-bar-'+t.id+'" style="width:0%"></i></div>';
      grid.appendChild(cell);
    });
  }
  function advisorStage(percent,fa,en){
    $('adv-progress-bar').style.width=percent+'%';$('adv-stage').textContent=tr(fa,en);
  }
  async function runSmartAdvisor() {
    if(advisorRunning)return;
    renderAdvisorSkeleton();
    if(isSandboxPreview){$('adv-verdict').textContent=tr('پیش‌نمایش آفلاین؛ آزمون شبکه فقط روی پنل نصب‌شده اجرا می‌شود.','Offline preview; run diagnostics on the deployed panel.');return;}
    advisorRunning=true;lastAdvisorPatch=null;advisorController=new AbortController();
    var signal=advisorController.signal,N=globalThis.NLNetwork;
    var deadline=setTimeout(function(){advisorController.abort();},65000);
    $('btn-adv-cancel').hidden=false;
    $('btn-adv-run').disabled=true;$('btn-adv-apply').hidden=true;$('adv-recs').hidden=true;
    $('adv-progress').hidden=false;$('adv-path-metrics').hidden=true;
    $('adv-run-ic').classList.add('ic-spin');
    $('adv-verdict').textContent=tr('در حال سنجش شبکهٔ همین مرورگر؛ تنظیمات فعلی دست‌نخورده می‌مانند…','Measuring this browser’s network; current settings are unchanged…');
    ADV_TARGETS.forEach(function(t){$('adv-bdg-'+t.id).textContent='WAIT';$('adv-ms-'+t.id).textContent='—';$('adv-bar-'+t.id).style.width='0%';});
    try {
      advisorStage(5,'۱ از ۴ · تأخیر، نوسان و WebSocket واقعی','1/4 · Latency, jitter and WebSocket');
      var base=await N.sample('/api/ping',{signal:signal,check:'health',credentials:'same-origin',timeout:2200},5);
      var ws=await N.wsProbe((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/api/network/ws',signal);
      var currentUser=getSelectedUser(),settings=STATE.settings||{},tunnel={ok:false,reason:'no-identity'};
      if(currentUser){
        var protocol=settings.enableVless?'vless':'trojan';
        var tunnelSamples=[];
        for(var probeIndex=0;probeIndex<3&&!signal.aborted;probeIndex++){tunnelSamples.push(await N.tunnelProbe((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+((settings.wsPath||'/').split('?')[0]||'/'),{protocol:protocol,uuid:currentUser.uuid,trojanHash:currentUser.trojanHash},{signal:signal,timeout:8000}));}
        var accepted=tunnelSamples.filter(function(v){return v.ok;});
        tunnel=accepted.length>=2?Object.assign({},accepted[0],{ms:N.median(accepted.map(function(v){return v.ms;})),replies:accepted.length,attempts:tunnelSamples.length}):Object.assign({},tunnelSamples[tunnelSamples.length-1]||tunnel,{ok:false,reason:accepted.length?'unstable-tunnel':(tunnelSamples[tunnelSamples.length-1]||tunnel).reason,replies:accepted.length,attempts:tunnelSamples.length});

      }
      var tunnelReasons={'unstable-tunnel':'پاسخ تکرارشوندهٔ کافی نبود','no-identity':'کاربر معتبر انتخاب نشده','websocket-error':'ارتباط WS/TLS برقرار نشد','websocket-timeout':'مهلت برقراری WebSocket تمام شد','tunnel-timeout':'پس از WS پاسخ HTTP نرسید','closed-before-http':'تونل پیش از پاسخ HTTP بسته شد','http-denied':'مقصد پاسخ HTTP ناموفق داد','invalid-response':'پاسخ غیرمنتظره','invalid-http-response':'پاسخ HTTP معتبر نبود','cancelled':'آزمون متوقف شد'};
      $('adv-tunnel').textContent=tunnel.ok?tunnel.protocol.toUpperCase()+' · HTTP '+tunnel.status+' · '+tunnel.ms+' ms · '+tunnel.replies+'/'+tunnel.attempts:tr('تأیید نشد: ','Not verified: ')+tr(tunnelReasons[tunnel.reason]||'پاسخ کامل دریافت نشد',tunnel.reason);
      if(signal.aborted)throw Error('cancelled');
      $('adv-path-metrics').hidden=false;
      $('adv-rtt').textContent=base.ms===null?'—':base.ms+' ms · '+base.replies+'/'+base.attempts;
      $('adv-jitter').textContent=(base.jitter===null?'—':base.jitter+' ms')+' / '+base.noReply+'%';
      $('adv-ws').textContent=ws.ok?ws.ms+' ms · '+ws.replies+'/'+ws.attempts:tr('پاسخ کافی نیست','NO STABLE REPLY');
      var completed=0,byId={};
      advisorStage(20,'۲ از ۴ · پورت‌های همین Worker و DNS رمزنگاری','2/4 · Worker TLS ports and encrypted DNS');
      var results=await N.bounded(ADV_TARGETS,3,async function(t){
        var r=await N.sample(t.url,{signal:signal,check:t.check,mode:t.kind==='opaque'?'no-cors':'cors',timeout:1800,headers:t.kind==='dns'?{accept:t.check==='dns-wire'?'application/dns-message':'application/dns-json'}:undefined},3);
        r.target=t;byId[t.id]=r;
        var b=$('adv-bdg-'+t.id);b.className=r.ok?'badge ok':'badge';
        b.textContent=r.ok?(t.kind==='opaque'?tr('پاسخ مرورگری','OPAQUE REPLY'):tr('تأیید پاسخ','VERIFIED REPLY')):tr('بی‌پاسخ / خطا','NO REPLY / ERROR');
        $('adv-ms-'+t.id).textContent=r.ms!==null?r.ms+' ms · '+r.replies+'/'+r.attempts:'—';
        $('adv-bar-'+t.id).style.width=(r.ok?Math.max(12,100-r.ms/20):0)+'%';
        completed++;advisorStage(20+Math.round(completed*40/ADV_TARGETS.length),'۲ از ۴ · '+completed+' از '+ADV_TARGETS.length+' مقصد','2/4 · '+completed+'/'+ADV_TARGETS.length+' targets');
        return r;
      },signal);
      if(signal.aborted)throw Error('cancelled');
      advisorStage(65,'۳ از ۴ · سه نمونهٔ دانلود و آپلود؛ تأخیر هنگام انتقال','3/4 · Bounded transfers and loaded latency');
      var loaded=[];
      async function transfer(method){
        var a=[];
        for(var i=0;i<3&&!signal.aborted;i++){
          var bytes=131072,body;
          if(method==='POST'){body=new Uint8Array(bytes);crypto.getRandomValues(body.subarray(0,65536));crypto.getRandomValues(body.subarray(65536));}
          var pair=await Promise.all([
            N.timed('/api/speed-probe?bytes='+bytes,{signal:signal,method:method,body:body,headers:method==='POST'?{'content-type':'application/octet-stream'}:undefined,check:method==='GET'?'download':'upload',bytes:bytes,credentials:'same-origin',timeout:4500}),
            (async function(){await new Promise(function(r){setTimeout(r,15);});return N.timed('/api/ping',{signal:signal,check:'health',credentials:'same-origin',timeout:2500});})()
          ]);
          a.push(pair[0]);loaded.push(pair[1]);
        }
        var out=N.summary(a);out.mbps=out.ms?Math.round(131072*8/(out.ms*1000)*100)/100:0;return out;
      }
      var down=await transfer('GET');advisorStage(80,'۳ از ۴ · بررسی آپلود و پایداری مسیر','3/4 · Upload path stability');
      var up=await transfer('POST');
      if(signal.aborted)throw Error('cancelled');
      function transferLabel(r){return r.ok?'~'+r.mbps.toFixed(2)+' Mbps · '+r.replies+'/'+r.attempts:tr('بی‌پاسخ / ناقص','NO REPLY / INCOMPLETE');}
      $('adv-down').textContent=transferLabel(down);$('adv-up').textContent=transferLabel(up);
      var load=N.summary(loaded);
      $('adv-loaded').textContent=load.ms===null?'—':load.ms+' ms'+(base.ms!==null?' (Δ '+(load.ms-base.ms)+' ms)':'');
      advisorStage(95,'۴ از ۴ · آماده‌سازی پیشنهادها؛ بدون اعمال خودکار','4/4 · Preparing changes for review');
      var patch={},s=STATE.settings||{},recs=[];
      function rec(fa,en){recs.push([fa,en]);}
      var iranPolicy=$('adv-policy')&&$('adv-policy').value==='iran';
      if(iranPolicy&&tunnel.ok){
        patch={alpn:'http/1.1',earlyData:0,enableHttpPorts:false,bypassIran:true,bypassLAN:true,bypassChina:false,bypassRussia:false,blockQuic:true};
        var measured443=results.some(function(r){return r.target.kind==='port'&&r.target.port===443&&r.ok;});if(measured443)patch.tlsPorts=[443];
        rec('پیشنهاد ایران پس از پاسخ تکرارشوندهٔ تونل: HTTP/1.1، بدون Early Data و پورت HTTP؛ سایت‌های ایرانی و شبکهٔ محلی مستقیم. UDP/443 اپ برای سازگاری TCP مسدود می‌شود. این سیاست سازگاری است، نه اثبات بهترین Fragment برای اپراتور.','Iran compatibility proposal after repeated tunnel replies: HTTP/1.1, no Early Data/plain HTTP, Iranian/local routes direct, application UDP/443 blocked. This is a policy, not a measured best-fragment claim.');
      }else if(!iranPolicy){rec('فقط اندازه‌گیری انتخاب شده است؛ هیچ تغییر تنظیمی پیشنهاد نمی‌شود.','Observation-only mode: no settings patch.');}
      else rec('تونل پاسخ کافی نداد؛ پروفایل ایران به‌عنوان تنظیم آزمایش‌شده پیشنهاد نشد. ابتدا خروجی پایه را در کلاینت تست کنید.','Insufficient tunnel replies: no tested-settings proposal; try the baseline in your client.');
      rec('برای انتخاب واقعی IP و Fragment، خروجی «انتخاب خودکار در Xray» را وارد برنامه کنید؛ هستهٔ برنامه مسیرها را آزمایش و کم‌تأخیرترین مسیر پاسخگو را انتخاب می‌کند.','For actual IP/Fragment selection, import the automatic Xray profile. The client core tests paths and selects the lowest-latency responding route.');
      rec('RTT صفحه یا خطای یک سایت باعث تغییر DNS، Early Data، طول Fragment یا فهرست IP شما نمی‌شود.','Page RTT or a failed website does not change DNS, Early Data, Fragment sizes or your IP list.');
      rec(tunnel.ok?'عبور HTTP از تونل دامنه تأیید شد؛ این نتیجه به معنی تست تک‌تک IPها نیست.':'عبور HTTP از تونل دامنه تأیید نشد؛ ابتدا خروجی پایهٔ 443 را در برنامه امتحان کنید.','The domain tunnel test is distinct from candidate scanning and client-core path selection.');
      var ports=results.filter(function(r){return r.target.kind==='port'&&r.ok;}).map(function(r){return r.target.port;});
      rec('پورت‌های دارای پاسخ سلامت همین Worker: '+(ports.join('، ')||'هیچ‌کدام در این نمونه')+'؛ فهرست پورت‌ها خودکار بازنویسی نمی‌شود.','This Worker’s health replied on: '+(ports.join(', ')||'none in this sample')+'. Existing TLS port choices are not overwritten.');
      var dns=results.filter(function(r){return r.target.kind==='dns'&&r.ok;}).sort(function(a,b){return a.ms-b.ms;});
      rec('DNSهای رمزنگاری با پاسخ معتبر: '+(dns.map(function(r){return r.target.name+' '+r.ms+'ms';}).join(' · ')||'پاسخ کافی نیست')+'؛ DNS انتخابی شما بی‌اجازه عوض نمی‌شود.','Validated encrypted DNS: '+(dns.map(function(r){return r.target.name+' '+r.ms+'ms';}).join(' · ')||'insufficient replies')+'. Your DNS preference is preserved.');
      if(load.ms!==null&&base.ms!==null&&load.ms>base.ms+Math.max(80,base.ms))rec('تأخیر هنگام نمونهٔ انتقال افزایش یافت؛ آزمون را بدون دانلودهای پس‌زمینه تکرار کنید. این نمونه تست کامل Bufferbloat نیست.','Loaded latency rose; repeat without background downloads. This small sample is not a complete bufferbloat test.');
      rec('نتیجه متعلق به مسیر همین مرورگر است، حتی اگر VPN یا پروکسی روشن باشد. خطای مرورگر، فیلتر/تحریم یا سلامت Fragment را اثبات نمی‌کند.','Results reflect this browser’s current route, including any VPN/proxy. Browser errors do not prove censorship, sanctions or Fragment performance.');
      rec('پس از تأیید، همهٔ ساب‌ها را در برنامه به‌روزرسانی کنید؛ URI عادی فقط فیلدهای سازگار را می‌برد و Fragment واقعی به پروفایل سازگار نیاز دارد.','Refresh every subscription after applying. Normal URIs carry compatible fields only; true Fragment requires a supported profile.');
      var changed=Object.keys(patch).filter(function(k){return s[k]!==patch[k];});
      var ul=$('adv-recs');ul.innerHTML='';ul.hidden=false;
      recs.forEach(function(r){var li=document.createElement('li');li.innerHTML='<span class="fa">'+esc(r[0])+'</span><span class="en">'+esc(r[1])+'</span>';ul.appendChild(li);});
      var changes=document.createElement('li');changes.className='advisor-changes';
      changes.textContent=tr('تغییرات پس از تأیید: ','Changes after confirmation: ')+(changed.length?changed.map(function(k){return k+': '+String(s[k])+' → '+String(patch[k]);}).join(' · '):tr('پروفایل سازگاری فعلی حفظ می‌شود.','Keep current compatibility profile.'));ul.appendChild(changes);
      lastAdvisorPatch=Object.keys(patch).length?patch:null;advisorCompletedAt=Date.now();
      var isp=STATE.cf.ispFa||STATE.cf.ispEn||tr('شبکهٔ فعلی','current network');
      $('adv-verdict').textContent=tr('آزمون کامل شد — ','Completed — ')+isp+' · '+(tunnel.ok?tr('عبور ترافیک از تونل تأیید شد؛ پیشنهادها را مرور کنید.','Tunnel HTTP verified; review recommendations.'):tr('عبور تونل تأیید نشد؛ نتیجهٔ صفحه را با اتصال کانفیگ اشتباه نگیرید.','Tunnel not verified; page reachability is not config connectivity.'));
      $('btn-adv-apply').hidden=STATE.mode!=='admin'||!lastAdvisorPatch;
      advisorStage(100,'آمادهٔ بررسی و تأیید شما','Ready for your review');
    }catch(err){
      lastAdvisorPatch=null;$('btn-adv-apply').hidden=true;
      $('adv-verdict').textContent=signal.aborted?tr('آزمون متوقف یا زمان آن تمام شد؛ هیچ تنظیمی تغییر نکرد.','Stopped or timed out; no settings changed.'):tr('آزمون ناقص بود؛ هیچ تنظیمی تغییر نکرد.','Incomplete diagnostic; no settings changed.');
      advisorStage(0,'بدون تغییر تنظیمات','No settings changed');
    }finally{
      clearTimeout(deadline);$('btn-adv-cancel').hidden=true;advisorRunning=false;$('btn-adv-run').disabled=false;$('adv-run-ic').classList.remove('ic-spin');
    }
  }
  if($('btn-adv-cancel'))$('btn-adv-cancel').onclick=function(){if(advisorController)advisorController.abort();};

  if ($('btn-adv-run')) {
    $('btn-adv-run').addEventListener('click', runSmartAdvisor);
  }

  if ($('btn-adv-apply')) {
    $('btn-adv-apply').addEventListener('click', async function () {
      if (!lastAdvisorPatch || STATE.mode !== 'admin') return;
      if (Date.now() - advisorCompletedAt > 300000) {
        showToast('نتیجه قدیمی است؛ آزمون را دوباره اجرا کنید.', 'Results expired; rerun diagnostics.');
        runSmartAdvisor(); return;
      }
      try {
        var merged = Object.assign({}, lastAdvisorPatch);
        var res = await api('/api/settings', 'PUT', merged);
        ingestBootstrap(res);
        $('btn-adv-apply').hidden = true;
        var uriChanged = Object.prototype.hasOwnProperty.call(lastAdvisorPatch, 'earlyData') ||
          Object.prototype.hasOwnProperty.call(lastAdvisorPatch, 'alpn');
        showToast(
          'تنظیمات ذخیره شد؛ همهٔ لینک‌های ساب را در کلاینت به‌روزرسانی کنید. هر فرمت فقط قابلیت‌های پشتیبانی‌شده را دریافت می‌کند.',
          uriChanged ? 'URI-compatible settings saved; refresh the same Normal subscription URL' : 'Structured routing saved; Normal URI unchanged'
        );
      } catch (err) {
        showToast(err.message, err.message);
      }
    });
  }

  if ($('btn-jump-advisor')) {
    $('btn-jump-advisor').addEventListener('click', function () {
      var card = $('advisor-master-card');
      var guestSlot = $('guest-advisor-slot');
      if (STATE.mode === 'admin') {
        if (card && $('pane-advisor') && card.parentElement !== $('pane-advisor')) {
          $('pane-advisor').appendChild(card);
        }
        if (guestSlot) guestSlot.hidden = true;
        if ($('btn-adv-close-guest')) $('btn-adv-close-guest').hidden = true;
        switchTab('advisor');
        runSmartAdvisor();
      } else if (card && guestSlot) {
        guestSlot.appendChild(card);
        guestSlot.hidden = false;
        if ($('btn-adv-close-guest')) $('btn-adv-close-guest').hidden = false;
        guestSlot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        runSmartAdvisor();
      }
    });
  }

  if ($('btn-adv-close-guest')) {
    $('btn-adv-close-guest').addEventListener('click', function () {
      var guestSlot = $('guest-advisor-slot');
      if (guestSlot) guestSlot.hidden = true;
    });
  }

  /* -------------------------------------------- Appearance */

  /* ----------------------------- Offline Sandbox Preview Shim (file:/null) */

  var isSandboxPreview = (location.protocol !== 'http:' && location.protocol !== 'https:') || window.origin === 'null';
  var demoStore = null;

  function ensureDemoStore() {
    if (demoStore) return demoStore;
    var u1 = {
      id: 'u_demo1', name: 'سردبیر (اصلی)', note: 'همراه اول · شخصی', enabled: true,
      uuid: '9d4c1f2e-77b3-4a51-9c2e-1f0b6d3a8e44', trojanPassword: 'NightDesk1950',
      subToken: 'k8m2x9p4q7w3n5r2', trafficLimitGB: 50, usedUpBytes: 412000000, usedDownBytes: 3890000000,
      usedBytes: 4302000000, limitBytes: 53687091200, connections: 42, expiryDays: 30,
      effectiveExpiresAt: Date.now() + 26 * 86400000, remainingDays: 26, startOnFirstUse: false, status: 'active'
    };
    var u2 = {
      id: 'u_demo2', name: 'مهمان — آیفون', note: 'شروع با اولین اتصال', enabled: true,
      uuid: '3b8a91c0-51f4-4d88-87a1-6c2d9e0f1122', trojanPassword: 'PressPass52',
      subToken: 'm9p4v7x2n8q3w6z1', trafficLimitGB: 20, usedUpBytes: 0, usedDownBytes: 1288490188,
      usedBytes: 1288490188, limitBytes: 21474836480, connections: 7, expiryDays: 15,
      effectiveExpiresAt: 0, remainingDays: 15, startOnFirstUse: true, status: 'active'
    };
    demoStore = {
      version: '2.5.8',
      mode: 'admin', kvBound: true, kvName: 'PREVIEW_KV', initialized: true, authenticated: true,
      edge: 'FRA', host: 'arenapanel.example.workers.dev',
      cfIntegration: {
        hasToken: true,
        maskedToken: '••••••••9f2a',
        accountId: 'demo_acc_01',
        accountName: 'Cloudflare Edge Account',
        scriptName: 'arenapanel',
        dailyLimit: 100000,
        canEditWorkers: true,
        tokensDashboardUrl: 'https://dash.cloudflare.com/profile/api-tokens'
      },
      settings: {
        enableVless: true, enableTrojan: true, killSwitch: false,
        wsPath: '/', earlyData: 2048,
        tlsPorts: [443, 8443, 2053, 2083, 2087, 2096],
        httpPorts: [80, 8080, 8880, 2052, 2082, 2086, 2095],
        enableHttpPorts: false,
        fingerprint: 'chrome', alpn: 'http/1.1',
        cleanIPs: ['www.speedtest.net#Speedtest', '172.67.73.163#US|CF-MCI'],
        customDomains: [],
        proxyIPs: ['ProxyIP.NL.CMLiussss.net', 'ProxyIP.DE.CMLiussss.net', 'ProxyIP.US.CMLiussss.net', 'nima.nscl.ir'],
        enableNAT64: true,
        nat64Prefixes: ['2a02:898:146:64::', '2602:fc59:b0:64::', '2602:fc59:11:64::'],
        chainProxy: '',
        enableTgProxy: true,
        tgProxySecret: '9f8e7d6c5b4a39281726354455667788',
        tgProxyDomain: '',
        enableFragment: true, fragmentPackets: 'tlshello', fragmentLength: '10-20', fragmentInterval: '10-20', enableNoise: false,
        upstreamDoH: 'https://1.1.1.1/dns-query', remoteDnsMode: 'private-doh', directDns: '8.8.8.8',
        bypassIran: true, bypassLAN: true, bypassChina: false, bypassRussia: false,
        blockQuic: true, blockAds: true, blockAdult: false, sanctionBypass: true,
        customDirectDomains: [], customProxyDomains: ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'docker.io', 'github.com'],
        customBlockDomains: [], showSubInfoNodes: true, rootMode: 'panel', fallbackDomain: ''
      },
      users: [u1, u2],
      logs: [
        { ts: Date.now() - 120000, event: 'setup', detail: 'پیش‌نمایش تعاملی پنل آماده است (V2.5.8)' },
        { ts: Date.now() - 30000, event: 'settings', detail: 'پروتکل‌های VLESS + Trojan + Telegram Web Proxy فعال شد' }
      ]
    };
    return demoStore;
  }

  function buildClientDemoNodes(user, s, host) {
    var list = [];
    var tlsPorts = (s.tlsPorts && s.tlsPorts.length) ? s.tlsPorts : [443];
    var targets = [{ addr: host, label: host }].concat(
      (s.cleanIPs || []).map(function (c) {
        var p = c.split('#');
        var addr = p[0].trim();
        var label = (p[1] || addr).trim();
        var geo = label.match(/^([A-Z]{2})\|(.*)$/i);
        if (geo && (/^\d{1,3}(\.\d{1,3}){3}$/.test(addr) || addr.indexOf(':') >= 0)) {
          var cc = geo[1].toUpperCase();
          var flag = String.fromCodePoint.apply(String, cc.split('').map(function (ch) { return 0x1f1e6 + ch.charCodeAt(0) - 65; }));
          label = flag + ' ' + cc + ' · ' + addr + (geo[2].trim() ? ' · ' + geo[2].trim() : '');
        }
        return { addr: addr, label: label };
      })
    );
    var path = (s.wsPath || '/') + (s.earlyData ? '?ed=' + s.earlyData : '');
    targets.forEach(function (t) {
      tlsPorts.forEach(function (port) {
        var ps = (tlsPorts.length > 1 || port !== 443) ? (':' + port) : '';
        if (s.enableVless) {
          var n1 = 'VLESS · ' + t.label + ps;
          list.push({
            name: n1, protocol: 'vless', port: port,
            uri: 'vless://' + user.uuid + '@' + t.addr + ':' + port + '?encryption=none&security=tls&sni=' + host + '&fp=' + s.fingerprint + '&type=ws&host=' + host + '&path=' + encodeURIComponent(path) + '#' + encodeURIComponent(n1)
          });
        }
        if (s.enableTrojan) {
          var n2 = 'Trojan · ' + t.label + ps;
          list.push({
            name: n2, protocol: 'trojan', port: port,
            uri: 'trojan://' + encodeURIComponent(user.trojanPassword) + '@' + t.addr + ':' + port + '?security=tls&sni=' + host + '&fp=' + s.fingerprint + '&type=ws&host=' + host + '&path=' + encodeURIComponent(path) + '#' + encodeURIComponent(n2)
          });
        }
      });
    });
    return list;
  }

  async function api(path, method, body, timeoutMs) {
    method = method || 'GET';
    if (isSandboxPreview) {
      var ds = ensureDemoStore();
      if (path === '/api/bootstrap') {
        ds.initialNodes = buildClientDemoNodes(ds.users[0], ds.settings, ds.host);
        return JSON.parse(JSON.stringify(ds));
      }
      if (path === '/api/killswitch') {
        ds.settings.killSwitch = !ds.settings.killSwitch;
        return JSON.parse(JSON.stringify(ds));
      }
      if (path === '/api/cf/ip-ranges') {
        return {
          ok: true, source: 'https://api.cloudflare.com/client/v4/ips', fetchedAt: Date.now(),
          ipv4: ['104.16.0.0/13', '172.64.0.0/13', '162.158.0.0/15', '198.41.128.0/17'],
          ipv6: ['2606:4700::/32', '2a06:98c0::/29'], cached: true
        };
      }
      if (path.indexOf('/api/cf/usage') === 0) {
        if (!ds.cfIntegration.hasToken) return { ok: false, needsToken: true, cfIntegration: ds.cfIntegration };
        return {
          ok: true,
          cfIntegration: ds.cfIntegration,
          usage: {
            usedToday: 14280,
            scriptRequests: 12940,
            dailyLimit: ds.cfIntegration.dailyLimit || 100000,
            pct: Math.round((14280 / (ds.cfIntegration.dailyLimit || 100000)) * 1000) / 10,
            resetInSec: 31200
          }
        };
      }
      if (path === '/api/cf/config') {
        if (body && body.action === 'clear') {
          ds.cfIntegration.hasToken = false;
          ds.cfIntegration.maskedToken = '';
          return { ok: true, cleared: true, cfIntegration: ds.cfIntegration };
        }
        ds.cfIntegration.hasToken = true;
        ds.cfIntegration.maskedToken = '••••••••' + String(body.token || '9f2a').slice(-4);
        ds.cfIntegration.scriptName = body.scriptName || 'arenapanel';
        ds.cfIntegration.dailyLimit = Number(body.dailyLimit) || 100000;
        return {
          ok: true,
          verified: true,
          saved: body.action !== 'verify',
          accountName: 'Cloudflare Edge Account',
          scriptName: ds.cfIntegration.scriptName,
          canReadAnalytics: true,
          canEditWorkers: true,
          cfIntegration: ds.cfIntegration,
          usage: { usedToday: 14280, dailyLimit: ds.cfIntegration.dailyLimit, pct: 14.3, resetInSec: 31200 }
        };
      }
      if (path === '/api/update/check') {
        return {
          ok: true,
          repo: OFFICIAL_GITHUB_REPO,
          repoUrl: OFFICIAL_GITHUB_URL,
          currentVersion: '2.5.8',
          latestVersion: '2.5.8',
          updateAvailable: false,
          releaseUrl: OFFICIAL_GITHUB_URL + '/releases',
          releaseNotes: 'ArenaPanel v2.5.8 — Latest release installed.',
          cfConfigured: ds.cfIntegration.hasToken,
          canEditWorkers: true,
          scriptName: ds.cfIntegration.scriptName || 'arenapanel'
        };
      }
      if (path === '/api/update/apply') {
        return {
          ok: true,
          updated: true,
          previousVersion: '2.5.8',
          targetVersion: '2.5.8',
          scriptName: (body && body.scriptName) || 'arenapanel',
          reloadAfterMs: 1200
        };
      }
      if (path === '/api/settings') {
        Object.assign(ds.settings, body || {});
        ds.initialNodes = buildClientDemoNodes(ds.users[0], ds.settings, ds.host);
        return JSON.parse(JSON.stringify(ds));
      }
      if (path === '/api/users' && method === 'POST') {
        var nu = {
          id: 'u_' + Math.random().toString(36).slice(2, 9),
          name: body.name || 'مشترک جدید', note: body.note || '', enabled: true,
          uuid: body.uuid || uuid4(), trojanPassword: body.trojanPassword || randPass(14),
          subToken: randPass(16).toLowerCase(), trafficLimitGB: Number(body.trafficLimitGB) || 0,
          usedBytes: 0, limitBytes: (Number(body.trafficLimitGB) || 0) * 1073741824,
          connections: 0, expiryDays: Number(body.expiryDays) || 0, remainingDays: Number(body.expiryDays) || null,
          startOnFirstUse: Boolean(body.startOnFirstUse), status: 'active'
        };
        ds.users.push(nu);
        return Object.assign({ ok: true, createdId: nu.id }, JSON.parse(JSON.stringify(ds)));
      }
      var mNode = path.match(/^\/api\/users\/([^/]+)\/nodes$/);
      if (mNode) {
        var u = ds.users.find(function (x) { return x.id === mNode[1]; }) || ds.users[0];
        return { ok: true, user: u, nodes: buildClientDemoNodes(u, ds.settings, ds.host) };
      }
      var mUser = path.match(/^\/api\/users\/([^/]+)$/);
      if (mUser) {
        var idx = ds.users.findIndex(function (x) { return x.id === mUser[1]; });
        if (idx >= 0 && method === 'DELETE') {
          if (ds.users.length > 1) ds.users.splice(idx, 1);
        } else if (idx >= 0 && method === 'PUT') {
          if (body.resetTraffic) ds.users[idx].usedBytes = 0;
          if (body.rotateKeys) { ds.users[idx].uuid = uuid4(); ds.users[idx].trojanPassword = randPass(14); }
          if (body.enabled !== undefined) { ds.users[idx].enabled = body.enabled; ds.users[idx].status = body.enabled ? 'active' : 'paused'; }
          if (body.name) ds.users[idx].name = body.name;
          if (body.note !== undefined) ds.users[idx].note = body.note;
          if (body.trafficLimitGB !== undefined) {
            ds.users[idx].trafficLimitGB = Number(body.trafficLimitGB) || 0;
            ds.users[idx].limitBytes = ds.users[idx].trafficLimitGB * 1073741824;
          }
        }
        return Object.assign({ ok: true }, JSON.parse(JSON.stringify(ds)));
      }
      if (path === '/api/test-proxyip') {
        return { ok: true, target: body.target || 'example.com:443', latencyMs: 42 };
      }
      if (path === '/api/backup') {
        return { ok: true, version: 2, exportedAt: new Date().toISOString(), settings: ds.settings, users: ds.users };
      }
      return { ok: true };
    }

    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var tid = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, timeoutMs||15000) : null;
    var opts = {
      method: method,
      credentials: 'same-origin',
      headers: { accept: 'application/json', 'x-nightline': '1' }
    };
    if (ctrl) opts.signal = ctrl.signal;
    if (body !== undefined) {
      opts.headers['content-type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    var res;
    try {
      res = await fetch(path, opts);
    } catch (netErr) {
      if (tid) clearTimeout(tid);
      if (netErr && netErr.name === 'AbortError') {
        throw new Error(tr('زمان درخواست به پایان رسید (Timeout).', 'Request timed out.'));
      }
      throw new Error(tr('ارتباط با سرور برقرار نشد؛ اتصال اینترنت را بررسی کنید.', 'Network error — could not reach Worker.'));
    }
    if (tid) clearTimeout(tid);

    var data = {};
    try { data = await res.json(); } catch (e) { data = {}; }

    if (res.status === 401 && path !== '/api/login' && path !== '/api/bootstrap') {
      ingestBootstrap({ mode: 'login', host: STATE.host, edge: STATE.edge });
      throw new Error(data.error || tr('نشست مدیریتی منقضی شده است؛ دوباره وارد شوید.', 'Session expired — please sign in again.'));
    }

    if (!res.ok || data.ok === false) {
      throw new Error(data.error || ('HTTP ' + res.status));
    }
    return data;
  }

  /* ------------------------------------------------- View & State Hydrator */

  function ingestBootstrap(data) {
    if (!data || typeof data !== 'object') return;
    var stateToMode = {
      needs_setup: 'setup',
      locked: 'login',
      stateless: 'stateless',
      needs_kv: 'stateless',
      ready: 'admin'
    };
    var resolvedMode = data.mode || stateToMode[data.state] || 'stateless';
    STATE.mode = resolvedMode;
    STATE.isDemo = isSandboxPreview;
    STATE.host = data.host || (data.cf && data.cf.host) || location.host || 'arenapanel.workers.dev';
    if (data.edge && data.edge !== 'CF-GLOBAL') STATE.edge = data.edge;
    else if (STATE.edge === '—' && data.edge) STATE.edge = data.edge;

    if (data.cf) mergeVisitorCf(data.cf);
    else renderVisitorStrip();

    $('mast-title').textContent = 'ArenaPanel';

    $('v-setup').hidden = resolvedMode !== 'setup';
    $('v-login').hidden = resolvedMode !== 'login';
    $('v-stateless').hidden = resolvedMode !== 'stateless';
    $('v-admin').hidden = resolvedMode !== 'admin';

    if (resolvedMode === 'stateless') {
      $('diag-mode').textContent = 'STATELESS';
      $('diag-kv').textContent = data.kvBound ? 'UNINITIALIZED' : 'NOT BOUND';
      $('diag-uuid').textContent = (data.hasEnvUuid || data.statelessUser) ? 'SET (READY)' : 'NOT SET';
      $('diag-edge').textContent = STATE.edge;
      renderStatelessTicket();
      return;
    }

    if (resolvedMode === 'admin') {
      // Ensure Smart Advisor card lives inside Tab 5 when entering Admin
      var advCard = $('advisor-master-card');
      if (advCard && $('pane-advisor') && advCard.parentElement !== $('pane-advisor')) {
        $('pane-advisor').appendChild(advCard);
      }
      if ($('guest-advisor-slot')) $('guest-advisor-slot').hidden = true;
      if ($('btn-adv-close-guest')) $('btn-adv-close-guest').hidden = true;
      renderAdvisorSkeleton();

      STATE.settings = data.settings;
      if (data.cfIntegration) STATE.cfIntegration = data.cfIntegration;
      STATE.users = data.users || [];
      STATE.logs = data.logs || [];
      $('demo-badge').hidden = !STATE.isDemo;

      if (!STATE.selectedUserId || !STATE.users.some(function (u) { return u.id === STATE.selectedUserId; })) {
        STATE.selectedUserId = STATE.users[0] ? STATE.users[0].id : '';
      }

      renderAdminHeader();
      populateSettingsForms();
      renderUsersLedger();
      renderActivityLogs();
      updateTelemetryKpis();
      syncCfQuotaUI();
      syncGhUpdaterUI(data.version);
      if(!ghAutoStarted){ghAutoStarted=true;setTimeout(function(){if(STATE.mode==='admin')checkGitHubUpdates(true);},1500);}
      if (STATE.cfIntegration && STATE.cfIntegration.hasToken && !STATE.cfUsage && !cfUsageFetching) {
        refreshCfDailyUsage(false);
      }

      if (data.initialNodes && STATE.users[0] && STATE.selectedUserId === STATE.users[0].id) {
        STATE.currentNodes = data.initialNodes;
        renderActiveUserPass();
        loadUserNodes(STATE.selectedUserId);
      } else {
        STATE.currentNodes = [];
        renderActiveUserPass();
        loadUserNodes(STATE.selectedUserId);
      }
    }
  }

  /* -------------------------------------- Setup, Login & Stateless Views */

  $('setup-gen-uuid').addEventListener('click', function () {
    $('setup-uuid').value = uuid4();
  });

  $('f-setup').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    $('setup-err').hidden = true;
    try {
      var res = await api('/api/setup', 'POST', {
        password: $('setup-pass').value,
        firstUserName: $('setup-name').value.trim(),
        preferredUuid: $('setup-uuid').value.trim()
      });
      showToast('تحریریه افتتاح شد', 'Panel initialized');
      ingestBootstrap(res);
    } catch (err) {
      $('setup-err').textContent = err.message;
      $('setup-err').hidden = false;
    }
  });

  $('f-login').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    $('login-err').hidden = true;
    try {
      var res = await api('/api/login', 'POST', {
        password: $('login-pass').value
      });
      $('login-pass').value = '';
      showToast('خوش آمدی — ورود انجام شد', 'Signed in to Desk');
      ingestBootstrap(res);
    } catch (err) {
      $('login-err').textContent = err.message;
      $('login-err').hidden = false;
    }
  });

  $('sub-jump-btn').addEventListener('click', function () {
    var tok = ($('sub-jump-inp').value || '').trim();
    if (!tok) return;
    window.open('/sub/' + encodeURIComponent(tok), '_blank', 'noopener');
  });

  $('sl-uuid').value = LS.get('uuid') || '';
  $('sl-mint').addEventListener('click', function () {
    $('sl-uuid').value = uuid4();
    LS.set('uuid', $('sl-uuid').value);
    renderStatelessTicket();
  });
  $('sl-uuid').addEventListener('input', function () {
    LS.set('uuid', $('sl-uuid').value.trim());
    renderStatelessTicket();
  });

  var slUri = '';
  function renderStatelessTicket() {
    var inp = $('sl-uuid');
    if (!inp) return;
    var id = (inp.value || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      $('sl-box').hidden = true;
      return;
    }
    $('sl-box').hidden = false;
    var h = STATE.host;
    slUri = 'vless://' + id + '@' + h + ':443?encryption=none&security=tls&sni=' + h + '&fp=chrome&type=ws&host=' + h + '&path=%2F%3Fed%3D2048#ArenaPanel';
    $('sl-sub').href = '/sub/' + id;
    drawQrInto('sl-qr', slUri);
  }
  $('sl-copy').addEventListener('click', function () {
    copyText(slUri, 'لینک VLESS', 'VLESS URI');
  });

  /* -------------------------------------------- Admin Header & Navigation */

  function renderAdminHeader() {
    var s = STATE.settings || {};
    $('st-edge').textContent = STATE.edge;
    $('st-kv').textContent = STATE.isDemo ? 'DEMO' : 'OK';
    var activeCount = STATE.users.filter(function (u) { return u.status === 'active'; }).length;
    $('st-users').textContent = activeCount + '/' + STATE.users.length;
    var totalB = STATE.users.reduce(function (acc, u) { return acc + (u.usedBytes || 0); }, 0);
    $('st-traffic').textContent = formatBytes(totalB);

    var killBtn = $('btn-kill');
    var killed = Boolean(s.killSwitch);
    killBtn.classList.toggle('active', killed);
    $('kill-fa').textContent = killed ? 'تونل متوقف (بازگشایی)' : 'قطع اضطراری: خاموش';
    $('kill-en').textContent = killed ? 'TUNNEL PAUSED (RESUME)' : 'KILL SWITCH: OFF';
  }

  $('btn-kill').addEventListener('click', async function () {
    try {
      var res = await api('/api/killswitch', 'POST', {});
      ingestBootstrap(res);
      showToast(
        res.settings.killSwitch ? 'تونل موقتاً متوقف شد' : 'تونل دوباره باز شد',
        res.settings.killSwitch ? 'Tunnel paused' : 'Tunnel resumed'
      );
    } catch (err) {
      showToast(err.message, err.message);
    }
  });

  $('btn-logout').addEventListener('click', async function () {
    try {
      await api('/api/logout', 'POST', {});
      location.reload();
    } catch (e) {
      location.reload();
    }
  });

  function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabName);
    });
    ['sub', 'users', 'net', 'route', 'advisor', 'sec'].forEach(function (t) {
      var p = $('pane-' + t);
      if (p) p.hidden = t !== tabName;
    });
    if (tabName === 'advisor') { renderAdvisorSkeleton(); runSmartAdvisor(); }
  }

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  $('go-add-user').addEventListener('click', function () {
    resetUserForm();
    switchTab('users');
    $('uf-name').focus();
  });

  /* ------------------------------------ Tab 1: Active User & Subscriptions */

  async function loadUserNodes(userId) {
    if (!userId) return;
    try {
      var res = await api('/api/users/' + encodeURIComponent(userId) + '/nodes', 'GET');
      if(STATE.selectedUserId!==userId)return;
      STATE.currentNodes = res.nodes || [];
      STATE.subscriptionMeta={userId:userId,title:res.subscriptionTitle,links:res.subscriptionLinks||{},at:Date.now()};
      renderActiveUserPass();
      return res;
    } catch (e) {return null;}
  }

  $('sel-user').addEventListener('change', function () {
    STATE.selectedUserId = $('sel-user').value;
    loadUserNodes(STATE.selectedUserId);
  });

  function getSelectedUser() {
    return STATE.users.find(function (u) { return u.id === STATE.selectedUserId; }) || STATE.users[0] || null;
  }

  function subBaseUrl(user) {
    var proto = location.protocol === 'http:' ? 'http://' : 'https://';
    return proto + STATE.host + '/sub/' + encodeURIComponent(user.subToken);
  }

  function dohFullUrl(user) {
    var proto = location.protocol === 'http:' ? 'http://' : 'https://';
    return proto + STATE.host + '/dns-query/' + encodeURIComponent(user.subToken);
  }

  function statusBadgeHtml(st) {
    var mapFa = { active: 'فعال · خط باز', paused: 'متوقف', expired: 'منقضی', quota: 'اتمام حجم' };
    var mapEn = { active: 'ACTIVE', paused: 'PAUSED', expired: 'EXPIRED', quota: 'QUOTA FULL' };
    var cls = st === 'active' ? 'badge ok' : 'badge bad';
    return '<span class="' + cls + '">' + esc(tr(mapFa[st] || st, mapEn[st] || st)) + '</span>';
  }

  function expiryText(u) {
    if (u.effectiveExpiresAt > 0) {
      return tr(u.remainingDays + ' روز مانده', u.remainingDays + ' days left');
    }
    if (u.startOnFirstUse && u.expiryDays > 0) {
      return tr(u.expiryDays + ' روز (از اولین اتصال)', u.expiryDays + 'd (on first connect)');
    }
    return tr('نامحدود', 'Unlimited');
  }

  function computeTgLinks(useLiveInputs) {
    var s = STATE.settings || {};
    var enabled = useLiveInputs && $('s-tgproxy') ? $('s-tgproxy').checked : (s.enableTgProxy !== false);
    var sec = (useLiveInputs && $('s-tgsecret') ? $('s-tgsecret').value : s.tgProxySecret) || '';
    sec = String(sec).trim().toLowerCase();
    if (/^(?:dd|ee|ef)[0-9a-f]{32}$/.test(sec)) sec = sec.slice(-32);
    var dom = (useLiveInputs && $('s-tgdomain') ? $('s-tgdomain').value : s.tgProxyDomain) || '';
    dom = String(dom).trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    var host = (dom || STATE.host || '').split(':')[0];
    if (!host || !/^[0-9a-f]{32}$/.test(sec)) {
      return { enabled: enabled, tgUrl: '', tmeUrl: '', host: host, secret: sec };
    }
    var qs = 'server=' + encodeURIComponent(host) + '&secret=' + sec;
    return {
      enabled: enabled,
      tgUrl: 'tg://webproxy?' + qs,
      tmeUrl: 'https://t.me/webproxy?' + qs,
      host: host,
      secret: sec
    };
  }

  function syncTgLinksUI() {
    var savedTg = computeTgLinks(false);
    var dashBox = $('dash-tg-box');
    if (dashBox) {
      dashBox.hidden = !savedTg.enabled || !savedTg.tgUrl;
      if (savedTg.tgUrl && $('dash-tg-open')) $('dash-tg-open').href = savedTg.tgUrl;
    }
    var liveTg = computeTgLinks(true);
    if ($('set-tg-open')) $('set-tg-open').href = liveTg.tgUrl || '#';
  }

  function renderActiveUserPass() {
    var sel = $('sel-user');
    sel.innerHTML = '';
    STATE.users.forEach(function (u) {
      var opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name + (u.note ? ' (' + u.note + ')' : '');
      if (u.id === STATE.selectedUserId) opt.selected = true;
      sel.appendChild(opt);
    });

    var u = getSelectedUser();
    if (!u) return;

    $('u-status-cell').innerHTML = statusBadgeHtml(u.status);
    var limStr = u.limitBytes > 0 ? formatBytes(u.limitBytes) : '∞';
    $('u-bw-cell').textContent = formatBytes(u.usedBytes || 0) + ' / ' + limStr;
    $('u-exp-cell').textContent = expiryText(u);
    $('u-uuid-cell').textContent = u.uuid;
    $('u-tr-cell').textContent = u.trojanPassword;

    var pct = computeUserTrafficPercent(u, STATE.users);
    $('u-meter').style.width = pct + '%';
    if ($('u-meter').parentElement) {
      $('u-meter').parentElement.classList.toggle('warn', u.limitBytes > 0 && pct >= 90);
    }

    var base = currentSubscriptionUrl(u,'b64');
    $('open-pass').href = '/sub/' + encodeURIComponent(u.subToken);
    syncTgLinksUI();

    STATE.currentQrText = base;
    STATE.currentQrCaption = 'NORMAL SUB · ' + u.name;
    $('qr-caption').textContent = STATE.currentQrCaption;
    drawQrInto('main-qr', STATE.currentQrText);

    var nodes = STATE.currentNodes || [];
    $('node-count').textContent = String(nodes.length);
    $('node-count-en').textContent = String(nodes.length);

    var nbox = $('admin-nodes');
    nbox.innerHTML = '';
    nodes.forEach(function (n) {
      var row = document.createElement('div');
      row.className = 'node-row';
      row.innerHTML =
        '<div class="node-title"><span class="badge inv">' + esc(n.protocol.toUpperCase()) + '</span> <span>' + esc(n.name) + '</span></div>' +
        '<div class="node-acts">' +
          '<button class="btn ghost sm-btn" type="button">' + svgIcon('qr', 'ic-sm') + '<span>QR</span></button>' +
          '<button class="btn primary sm-btn" type="button">' + svgIcon('copy', 'ic-sm') + '<span>' + esc(tr('کپی', 'COPY')) + '</span></button>' +
        '</div>';
      var btns = row.querySelectorAll('button');
      btns[0].onclick = function () {
        STATE.currentQrText = n.uri;
        $('qr-caption').textContent = n.name;
        drawQrInto('main-qr', n.uri);
      };
      btns[1].onclick = function () {
        copyText(n.uri, n.name, n.name);
      };
      nbox.appendChild(row);
    });
  }

  function currentSubscriptionUrl(user,format){var m=STATE.subscriptionMeta;if(m&&m.userId===user.id&&m.links[format])return m.links[format];var q=new URL(subBaseUrl(user));q.searchParams.set('format',format);q.hash='ArenaPanel · '+user.name+' · CC ?';return q.toString();}
  async function refreshedSubscriptionUrl(user,format){var fresh=await loadUserNodes(user.id);if(!fresh)throw Error(tr('دریافت اطلاعات تازهٔ اشتراک ناموفق بود؛ دوباره تلاش کنید.','Fresh subscription metadata could not be loaded; please retry.'));if(!getSelectedUser()||getSelectedUser().id!==user.id)throw Error(tr('کاربر تغییر کرد؛ دوباره تلاش کنید.','Selected user changed; try again.'));return currentSubscriptionUrl(user,format);}
  [['cp-b64','b64'],['cp-xray','xray'],['cp-sb','singbox'],['cp-clash','clash']].forEach(function(pair){$(pair[0]).onclick=async function(){var u=getSelectedUser();if(!u)return;this.disabled=true;try{var pending=refreshedSubscriptionUrl(u,pair[1]);if(navigator.clipboard&&navigator.clipboard.write&&globalThis.ClipboardItem){try{await navigator.clipboard.write([new ClipboardItem({'text/plain':pending.then(function(link){return new Blob([link],{type:'text/plain'});})})]);showToast('لینک اشتراک با برچسب کشور رونوشت شد','Country-labelled subscription URL copied');}catch(e){copyText(await pending,'لینک اشتراک با برچسب کشور','Subscription URL with country label');}}else copyText(await pending,'لینک اشتراک با برچسب کشور','Subscription URL with country label');}catch(e){showToast(e.message,e.message);}finally{this.disabled=false;}};});
  $('cp-doh').onclick=function(){var u=getSelectedUser();if(u)copyText(dohFullUrl(u),'آدرس DoH اختصاصی','Private DoH URL');};
  [['qr-btn-b64','b64'],['qr-btn-xray','xray'],['qr-btn-sb','singbox']].forEach(function(pair){$(pair[0]).onclick=async function(){var u=getSelectedUser();if(!u)return;this.disabled=true;try{STATE.currentQrText=await refreshedSubscriptionUrl(u,pair[1]);$('qr-caption').textContent=(STATE.subscriptionMeta&&STATE.subscriptionMeta.title)||u.name;drawQrInto('main-qr',STATE.currentQrText);}catch(e){showToast(e.message,e.message);}finally{this.disabled=false;}};});
  if ($('qr-btn-tg')) {
    $('qr-btn-tg').onclick = function () {
      var tg = computeTgLinks(false);
      if (!tg.tmeUrl) { showToast('پروکسی تلگرام غیرفعال است', 'Telegram Proxy is disabled'); return; }
      STATE.currentQrText = tg.tmeUrl;
      $('qr-caption').textContent = 'TELEGRAM WEB PROXY';
      drawQrInto('main-qr', STATE.currentQrText);
    };
  }
  if ($('dash-tg-copy')) {
    $('dash-tg-copy').onclick = function () {
      var tg = computeTgLinks(false);
      if (tg.tmeUrl) copyText(tg.tmeUrl, 'لینک پروکسی تلگرام', 'Telegram Proxy URL');
    };
  }

  /* ------------------------------------ Tab 2: Subscribers CRUD & Ledger */

  $('uf-gen-uuid').onclick = function () { $('uf-uuid').value = uuid4(); };
  $('uf-gen-tr').onclick = function () { $('uf-tr').value = randPass(14); };

  function resetUserForm() {
    $('uf-id').value = '';
    $('uf-name').value = '';
    $('uf-note').value = '';
    $('uf-gb').value = '0';
    $('uf-days').value = '0';
    $('uf-uuid').value = '';
    $('uf-tr').value = '';
    $('uf-first').checked = false;
    $('uf-reset').hidden = true;
    $('uf-title-fa').textContent = 'افزودنِ مشترک تازه';
    $('uf-title-en').textContent = 'ADD NEW SUBSCRIBER';
    $('uf-submit-fa').textContent = 'ثبتِ مشترک';
    $('uf-submit-en').textContent = 'CREATE SUBSCRIBER';
  }

  $('uf-reset').onclick = resetUserForm;

  $('f-user').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var editId = $('uf-id').value;
    var payload = {
      name: $('uf-name').value.trim(),
      note: $('uf-note').value.trim(),
      trafficLimitGB: Number($('uf-gb').value) || 0,
      expiryDays: Number($('uf-days').value) || 0,
      startOnFirstUse: $('uf-first').checked
    };
    if ($('uf-uuid').value.trim()) payload.uuid = $('uf-uuid').value.trim();
    if ($('uf-tr').value.trim()) payload.trojanPassword = $('uf-tr').value.trim();

    try {
      var res;
      if (editId) {
        res = await api('/api/users/' + encodeURIComponent(editId), 'PUT', payload);
        showToast('مشترک ویرایش شد', 'Subscriber updated');
      } else {
        res = await api('/api/users', 'POST', payload);
        if (res.createdId) STATE.selectedUserId = res.createdId;
        showToast('مشترک جدید ساخته شد', 'Subscriber created');
      }
      resetUserForm();
      ingestBootstrap(res);
    } catch (err) {
      showToast(err.message, err.message);
    }
  });

  function renderUsersLedger() {
    var box = $('users-list');
    box.innerHTML = '';

    STATE.users.forEach(function (u) {
      var card = document.createElement('div');
      card.className = 'user-card';
      var lim = u.limitBytes > 0 ? formatBytes(u.limitBytes) : '∞';
      var pct = computeUserTrafficPercent(u, STATE.users);

      card.innerHTML =
        '<div class="user-head">' +
          '<div class="user-name">' + svgIcon('users', 'ic-sm') + '<span>' + esc(u.name) + '</span>' + (u.note ? ' <span class="mono sm" style="opacity:.65">(' + esc(u.note) + ')</span>' : '') + '</div>' +
          '<div>' + statusBadgeHtml(u.status) + '</div>' +
        '</div>' +
        '<div class="user-meta">' +
          '<div><span>' + esc(tr('مصرف / سقف', 'TRAFFIC')) + '</span><b>' + esc(formatBytes(u.usedBytes || 0) + ' / ' + lim) + '</b></div>' +
          '<div><span>' + esc(tr('اعتبار', 'EXPIRY')) + '</span><b>' + esc(expiryText(u)) + '</b></div>' +
          '<div><span>' + esc(tr('اتصال‌ها', 'CONNECTIONS')) + '</span><b>' + (u.connections || 0) + '</b></div>' +
          '<div><span>SUB TOKEN</span><b>' + esc(u.subToken) + '</b></div>' +
        '</div>' +
        '<div class="meter' + (pct >= 90 ? ' warn' : '') + '"><i style="width:' + pct + '%"></i></div>' +
        '<div class="actions" style="margin-top:4px">' +
          '<button class="btn primary sm-btn u-act-sub" type="button">' + svgIcon('qr', 'ic-sm') + '<span>' + esc(tr('لینک و QR', 'LINKS & QR')) + '</span></button>' +
          '<button class="btn ghost sm-btn u-act-edit" type="button">' + esc(tr('ویرایش', 'EDIT')) + '</button>' +
          '<button class="btn ghost sm-btn u-act-toggle" type="button">' + esc(u.enabled ? tr('توقف', 'PAUSE') : tr('فعال‌سازی', 'RESUME')) + '</button>' +
          '<button class="btn ghost sm-btn u-act-reset" type="button">' + esc(tr('صفر کردن مصرف', 'RESET GB')) + '</button>' +
          '<button class="btn ghost sm-btn u-act-rot" type="button">' + esc(tr('تعویض کلیدها', 'ROTATE KEYS')) + '</button>' +
          (STATE.users.length > 1
            ? '<button class="btn danger sm-btn u-act-del" type="button">' + esc(tr('حذف', 'DELETE')) + '</button>'
            : '') +
        '</div>';

      card.querySelector('.u-act-sub').onclick = function () {
        STATE.selectedUserId = u.id;
        switchTab('sub');
        loadUserNodes(u.id);
      };
      card.querySelector('.u-act-edit').onclick = function () {
        $('uf-id').value = u.id;
        $('uf-name').value = u.name;
        $('uf-note').value = u.note || '';
        $('uf-gb').value = String(u.trafficLimitGB || 0);
        $('uf-days').value = String(u.expiryDays || 0);
        $('uf-uuid').value = u.uuid;
        $('uf-tr').value = u.trojanPassword;
        $('uf-first').checked = Boolean(u.startOnFirstUse);
        $('uf-reset').hidden = false;
        $('uf-title-fa').textContent = 'ویرایشِ مشترک: ' + u.name;
        $('uf-title-en').textContent = 'EDIT SUBSCRIBER: ' + u.name;
        $('uf-submit-fa').textContent = 'ذخیرهٔ تغییرات';
        $('uf-submit-en').textContent = 'UPDATE SUBSCRIBER';
        $('f-user').scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      card.querySelector('.u-act-toggle').onclick = async function () {
        try {
          var r = await api('/api/users/' + encodeURIComponent(u.id), 'PUT', { enabled: !u.enabled });
          ingestBootstrap(r);
          showToast('وضعیت مشترک تغییر کرد', 'Status updated');
        } catch (err) {
          showToast(err.message, err.message);
        }
      };
      card.querySelector('.u-act-reset').onclick = async function () {
        try {
          var r = await api('/api/users/' + encodeURIComponent(u.id), 'PUT', { resetTraffic: true });
          ingestBootstrap(r);
          showToast('مصرف مشترک صفر شد', 'Bandwidth reset');
        } catch (err) {
          showToast(err.message, err.message);
        }
      };
      card.querySelector('.u-act-rot').onclick = async function () {
        try {
          var r = await api('/api/users/' + encodeURIComponent(u.id), 'PUT', { rotateKeys: true });
          ingestBootstrap(r);
          showToast('شناسه، رمز Trojan و توکن تعویض شد', 'Keys rotated');
        } catch (err) {
          showToast(err.message, err.message);
        }
      };
      var delBtn = card.querySelector('.u-act-del');
      if (delBtn) {
        delBtn.onclick = async function () {
          try {
            var r = await api('/api/users/' + encodeURIComponent(u.id), 'DELETE');
            ingestBootstrap(r);
            showToast('مشترک حذف شد', 'Subscriber deleted');
          } catch (err) {
            showToast(err.message, err.message);
          }
        };
      }

      box.appendChild(card);
    });
  }

  /* ------------------------------------ Tabs 3, 4, 6: Settings & Scanners */

  function linesToText(arr) {
    return Array.isArray(arr) ? arr.join('\n') : '';
  }

  function textToLines(str) {
    return String(str || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function populateSettingsForms() {
    var s = STATE.settings || {};

    $('s-vless').checked = Boolean(s.enableVless);
    $('s-trojan').checked = Boolean(s.enableTrojan);
    $('s-http-on').checked = Boolean(s.enableHttpPorts);

    var tlsSet = new Set((s.tlsPorts || [443]).map(Number));
    $('tls-ports-box').querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      cb.checked = tlsSet.has(Number(cb.value));
    });

    var httpSet = new Set((s.httpPorts || [80, 8080, 8880, 2052, 2082, 2086, 2095]).map(Number));
    if ($('http-ports-box')) {
      $('http-ports-box').querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        cb.checked = httpSet.has(Number(cb.value));
      });
    }

    $('s-fp').value = s.fingerprint || 'chrome';
    $('s-alpn').value = s.alpn || 'http/1.1';
    $('s-ed').value = String(s.earlyData != null ? s.earlyData : 2048);
    $('s-wspath').value = s.wsPath || '/';

    $('s-frag-on').checked = Boolean(s.enableFragment);
    $('s-frag-pkt').value = s.fragmentPackets || 'tlshello';
    $('s-frag-len').value = s.fragmentLength || '10-20';
    $('s-frag-int').value = s.fragmentInterval || '10-20';
    $('s-noise').checked = Boolean(s.enableNoise);

    $('s-cleanips').value = linesToText(s.cleanIPs);
    $('s-custom-domains').value = linesToText(s.customDomains);
    $('s-proxyips').value = linesToText(s.proxyIPs);
    $('s-nat64-on').checked = Boolean(s.enableNAT64);
    $('s-nat64').value = linesToText(s.nat64Prefixes);
    $('s-chain').value = s.chainProxy || '';

    if ($('s-tgproxy')) $('s-tgproxy').checked = s.enableTgProxy !== false;
    if ($('s-tgsecret')) $('s-tgsecret').value = s.tgProxySecret || '';
    if ($('s-tgdomain')) $('s-tgdomain').value = s.tgProxyDomain || '';
    syncTgLinksUI();

    $('s-updoh').value = s.upstreamDoH || 'https://1.1.1.1/dns-query';
    $('s-remotedns').value = s.remoteDnsMode || 'private-doh';
    $('s-directdns').value = s.directDns || '8.8.8.8';

    $('r-ir').checked = Boolean(s.bypassIran);
    $('r-lan').checked = Boolean(s.bypassLAN);
    $('r-quic').checked = Boolean(s.blockQuic);
    $('r-ads').checked = Boolean(s.blockAds);
    $('r-adult').checked = Boolean(s.blockAdult);
    $('r-sanction').checked = Boolean(s.sanctionBypass);
    $('r-cn').checked = Boolean(s.bypassChina);
    $('r-ru').checked = Boolean(s.bypassRussia);

    $('r-proxy-list').value = linesToText(s.customProxyDomains);
    $('r-direct-list').value = linesToText(s.customDirectDomains);
    $('r-block-list').value = linesToText(s.customBlockDomains);

    $('s-rootmode').value = s.rootMode || 'panel';
    $('s-fallback').value = s.fallbackDomain || '';
    $('s-infonodes').checked = true;
  }

  function collectSettingsFromForms() {
    var ports = [];
    $('tls-ports-box').querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      if (cb.checked) ports.push(Number(cb.value));
    });
    if (!ports.length) ports = [443];

    var hPorts = [];
    if ($('http-ports-box')) {
      $('http-ports-box').querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        if (cb.checked) hPorts.push(Number(cb.value));
      });
    }
    if (!hPorts.length) hPorts = [80];

    return {
      enableVless: $('s-vless').checked,
      enableTrojan: $('s-trojan').checked,
      enableHttpPorts: $('s-http-on').checked,
      tlsPorts: ports,
      httpPorts: hPorts,
      fingerprint: $('s-fp').value,
      alpn: $('s-alpn').value,
      earlyData: Number($('s-ed').value),
      wsPath: $('s-wspath').value.trim() || '/',

      enableFragment: $('s-frag-on').checked,
      fragmentPackets: $('s-frag-pkt').value.trim() || 'tlshello',
      fragmentLength: $('s-frag-len').value.trim() || '10-20',
      fragmentInterval: $('s-frag-int').value.trim() || '10-20',
      enableNoise: $('s-noise').checked,

      cleanIPs: textToLines($('s-cleanips').value),
      customDomains: textToLines($('s-custom-domains').value),
      proxyIPs: textToLines($('s-proxyips').value),
      enableNAT64: $('s-nat64-on').checked,
      nat64Prefixes: textToLines($('s-nat64').value),
      chainProxy: $('s-chain').value.trim(),

      enableTgProxy: $('s-tgproxy') ? $('s-tgproxy').checked : true,
      tgProxySecret: $('s-tgsecret') ? $('s-tgsecret').value.trim() : '',
      tgProxyDomain: $('s-tgdomain') ? $('s-tgdomain').value.trim() : '',

      upstreamDoH: $('s-updoh').value,
      remoteDnsMode: $('s-remotedns').value,
      directDns: $('s-directdns').value.trim() || '8.8.8.8',

      bypassIran: $('r-ir').checked,
      bypassLAN: $('r-lan').checked,
      blockQuic: $('r-quic').checked,
      blockAds: $('r-ads').checked,
      blockAdult: $('r-adult').checked,
      sanctionBypass: $('r-sanction').checked,
      bypassChina: $('r-cn').checked,
      bypassRussia: $('r-ru').checked,

      customProxyDomains: textToLines($('r-proxy-list').value),
      customDirectDomains: textToLines($('r-direct-list').value),
      customBlockDomains: textToLines($('r-block-list').value),

      rootMode: $('s-rootmode').value,
      fallbackDomain: $('s-fallback').value.trim(),
      showSubInfoNodes: true
    };
  }

  async function saveAllSettings() {
    try {
      var patch = collectSettingsFromForms();
      var res = await api('/api/settings', 'PUT', patch);
      ingestBootstrap(res);
      showToast('تنظیمات در KV ذخیره شد', 'Settings saved to KV');
    } catch (err) {
      showToast(err.message, err.message);
    }
  }

  $('save-net').onclick = saveAllSettings;
  $('save-route').onclick = saveAllSettings;
  $('save-sec').onclick = saveAllSettings;

  if ($('btn-gen-tgsecret')) {
    $('btn-gen-tgsecret').onclick = function () {
      $('s-tgsecret').value = randHex(16);
      syncTgLinksUI();
      showToast('سکرت جدید ساخته شد؛ دکمهٔ ذخیره را بزن', 'New secret generated — click Save');
    };
  }
  if ($('s-tgsecret')) $('s-tgsecret').addEventListener('input', syncTgLinksUI);
  if ($('s-tgdomain')) $('s-tgdomain').addEventListener('input', syncTgLinksUI);
  if ($('s-tgproxy')) $('s-tgproxy').addEventListener('change', syncTgLinksUI);
  if ($('set-tg-copy')) {
    $('set-tg-copy').onclick = function () {
      var tg = computeTgLinks(true);
      if (tg.tmeUrl) copyText(tg.tmeUrl, 'لینک پروکسی تلگرام', 'Telegram Proxy URL');
      else showToast('کلید مخفی ۳۲ کاراکتری معتبر نیست', 'Invalid 32-hex secret');
    };
  }

  ['adv-baseline','adv-fragment-small','adv-fragment-lab','adv-auto-xray'].forEach(function(id){if($(id))$(id).onclick=function(){var u=getSelectedUser();if(!u){showToast('ابتدا وارد پنل شوید و کاربر را انتخاب کنید','Select a user first');return;}if(id==='adv-auto-xray'&&JSON.stringify(textToLines($('s-cleanips').value))!==JSON.stringify((STATE.settings||{}).cleanIPs||[])){showToast('ابتدا نامزدها را با دکمهٔ ذخیرهٔ تنظیمات شبکه ثبت کنید','Save the candidate list in Network settings first');return;}var a=document.createElement('a');a.href=subBaseUrl(u)+'?format=xray&profile='+(id==='adv-auto-xray'?'auto':id==='adv-baseline'?'baseline':id==='adv-fragment-lab'?'fragment-lab':'tlshello-small');a.target='_blank';a.rel='noopener noreferrer';a.click();};});
  document.querySelectorAll('.frag-preset').forEach(function (btn) {
    btn.onclick = function () {
      $('s-frag-on').checked = true;
      $('s-frag-pkt').value = btn.getAttribute('data-p');
      $('s-frag-len').value = btn.getAttribute('data-l');
      $('s-frag-int').value = btn.getAttribute('data-i');
      showToast('پیش‌تنظیم Fragment اعمال شد؛ دکمهٔ ذخیره را بزن', 'Preset loaded — click Save');
    };
  });

  $('btn-add-presets').onclick = function () {
    var presets = [
      'www.speedtest.net#Speedtest',
      'cp.cloudflare.com#CF-Captive',
      'radar.cloudflare.com#CF-Radar',
      '172.67.73.163#CF-Anycast-1',
      '104.18.2.14#CF-Anycast-2',
      '162.159.135.42#CF-Anycast-3'
    ];
    var existing = textToLines($('s-cleanips').value);
    presets.forEach(function (p) {
      if (existing.indexOf(p) < 0) existing.push(p);
    });
    $('s-cleanips').value = existing.join('\n');
    showToast('دامنه‌ها و IPهای تمیز اضافه شد', 'Clean IP presets added');
  };

  /* -------------------- Browser Clean IP / Domain Scanner ---------------- */

  var lastUserScanCandidates = [];

  function parseUserCleanLine(rawLine) {
    var line = String(rawLine || '').trim();
    if (!line) return null;
    var hashIdx = line.indexOf('#');
    var addrPart = (hashIdx >= 0 ? line.slice(0, hashIdx) : line).trim();
    var remark = (hashIdx >= 0 ? line.slice(hashIdx + 1) : '').trim();
    if (!addrPart) return null;

    var host = addrPart;
    var port = 443;
    if (addrPart.charAt(0) === '[') {
      var closeBr = addrPart.indexOf(']');
      if (closeBr > 0) {
        host = addrPart.slice(0, closeBr + 1);
        var rest = addrPart.slice(closeBr + 1);
        if (rest.charAt(0) === ':') port = Number(rest.slice(1)) || 443;
      }
    } else {
      var colons = addrPart.split(':');
      if (colons.length === 2 && /^\d+$/.test(colons[1])) {
        host = colons[0];
        port = Number(colons[1]) || 443;
      } else if (colons.length > 2) {
        host = '[' + addrPart + ']';
      }
    }
    var bare = host.replace(/^\[|\]$/g, '');
    var isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(bare);
    var isIpv6 = bare.indexOf(':') >= 0;
    var geoMatch = remark.match(/^(?:manual:)?([A-Z]{2})\|(.*)$/i);
    return {
      rawLine: line,
      addrPart: addrPart,
      host: host,
      bareHost: bare,
      port: port,
      remark: remark || bare,
      countryManual:/^manual:/i.test(remark),
      countryCode: geoMatch ? geoMatch[1].toUpperCase() : '',
      isRawIp: isIpv4 || isIpv6
    };
  }

  var scannerController=null,scannerRunning=false,scanCalibration=null,officialRanges=null;
  var scanCounts={tested:0,http:0,candidates:0,timeouts:0},scanGoal=0,scanRangeMode=false;
  function scanBusy(on){scannerRunning=on;['btn-scan-user-list','btn-scan-ranges','btn-scan-clean','btn-country-list'].forEach(function(id){if($(id))$(id).disabled=on;});$('btn-scan-stop').hidden=!on;}
  $('btn-scan-stop').onclick=function(){if(scannerController)scannerController.abort();};
  function updateScanSummary(stopped){$('scan-summary').textContent=(stopped?tr('متوقف شد · ','Stopped · '):'')+scanCounts.tested+(Number.isFinite(scanGoal)?'/'+scanGoal:tr(' · پیوسته',' · continuous'))+tr(' بررسی · HTTP: ',' tested · HTTP: ')+scanCounts.http+tr(' · نامزد: ',' · candidates: ')+scanCounts.candidates+tr(' · بی‌پاسخ: ',' · timed out: ')+scanCounts.timeouts+tr('؛ نمایش ۴۰۰ نتیجهٔ آخر؛ هیچ IPی حذف نمی‌شود.','; latest 400 rows shown; no IP is removed.');}
  function scanBadge(r){if(r.kind==='unstable')return 'HTTP '+r.replies+'/'+r.attempts+' · '+tr('ناپایدار','UNSTABLE');if(r.ok)return 'HTTP · '+r.responseMs+' ms';if(r.candidate)return tr('نامزد · واکنش ','CANDIDATE · REACTION ')+r.candidateMs+' ms';return r.kind==='timeout'?tr('بی‌پاسخ · مهلت تمام شد','TIMEOUT'):tr('تأیید نشده','UNCONFIRMED');}
  function scanDetail(r){if(r.kind==='unstable')return tr('پاسخ HTTP دریافت شد اما تکرارپذیر نبود.','HTTP replied, but not consistently.');return r.ok?tr('پاسخ واقعی؛ اتصال کانفیگ را جدا تست کنید.','Actual response; verify config connectivity separately.'):r.candidate?tr('سرنخ مرورگر؛ تأیید نهایی با کلاینت.','Browser candidate; verify in client.'):r.kind==='timeout'?tr('در این تلاش پاسخی نرسید؛ قطع قطعی یا فیلترینگ ثابت نشده است.','No response before the deadline; not proof of blocking.'):tr('خطای مرورگر یا مسیر؛ وضعیت اتصال نامعلوم است.','Browser/path error; connectivity remains unknown.');}
  function attachCountryToEntry(entry,cc){if(!entry.isRawIp)return;var note=entry.remark.replace(/^(?:manual:)?[A-Z]{2}\|/i,'').trim();if(note===entry.bareHost)note='Scan';entry.countryCode=cc||'';entry.rawLine=entry.addrPart+'#'+(cc?cc+'|':'')+(note||'Scan');}
  async function enrichScanCountries(results,force){
    var targets=results.filter(function(r){return r.entry.isRawIp;});
    for(var i=0;i<targets.length;i+=16){if(scannerController&&scannerController.signal.aborted)break;var part=targets.slice(i,i+16);
      var response=await fetch('/api/tools/geoip',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({ips:part.map(function(r){return r.entry.bareHost;}),refresh:!!force}),signal:scannerController?scannerController.signal:undefined});
      if(!response.ok)continue;var data=await response.json();(data.results||[]).forEach(function(g,j){var r=part[j];if(!r)return;r.entry.geo=g;if(!r.entry.countryManual)attachCountryToEntry(r.entry,g.countryCode||'');if(r.element){var field=r.element.querySelector('.scan-country');field.textContent=(r.entry.countryCode||'CC ?')+' · '+(g.confidence==='two-sources'?tr('۲ منبع','2 sources'):r.entry.countryManual?tr('برچسب دستی','manual label'):g.confidence==='conflict'?tr('اختلاف منابع','conflict'):g.confidence==='single-source'?tr('تقریبی · ۱ منبع','approx. · 1 source'):tr('کشور نامعلوم','country unknown'));field.title=(g.sources||[]).join(' + ');}});
    }
  }
  function appendScanResult(r){
    if(scannerController.signal.aborted)return;scanCounts.tested++;if(r.ok)scanCounts.http++;else if(r.candidate)scanCounts.candidates++;else if(r.kind==='timeout')scanCounts.timeouts++;
    if(r.ok||r.candidate){lastUserScanCandidates.push(r);lastUserScanCandidates.sort(function(a,b){return a.sortMs-b.sortMs;});if(lastUserScanCandidates.length>500)lastUserScanCandidates.length=500;}
    var item=document.createElement('div');item.className='scan-item '+(scanRangeMode?'range-result ':'')+(r.ok?'state-ok':r.candidate?'state-candidate':r.kind==='timeout'?'state-bad':'state-unknown');
    item.innerHTML='<span class="scan-entry mono" dir="ltr">'+esc(r.entry.bareHost+(r.entry.port!==443?':'+r.entry.port:''))+' <small class="scan-country">'+esc(r.entry.countryCode||'CC ?')+'</small></span><span class="badge '+(r.ok?'ok':r.kind==='timeout'?'bad':r.candidate?'candidate':'')+'">'+esc(scanBadge(r))+'</span><small class="scan-detail">'+esc(scanDetail(r))+'</small>';
    if(scanRangeMode){var manual=document.createElement('input');manual.className='range-manual-cc mono';manual.maxLength=2;manual.placeholder=tr('کد کشور دستی','CC');manual.setAttribute('aria-label','Manual country code');item.appendChild(manual);var add=document.createElement('button');add.type='button';add.className='btn ghost sm-btn';add.innerHTML=svgIcon('plus','ic-sm')+'<span>ADD</span>';add.onclick=function(){var cc=manual.value.trim().toUpperCase()||r.entry.countryCode;if(cc&&!/^[A-Z]{2}$/.test(cc)){showToast('کد کشور دو حرفی باشد','Use a two-letter code');return;}if(cc)attachCountryToEntry(r.entry,cc);if(manual.value.trim()&&cc)r.entry.rawLine=r.entry.rawLine.replace('#','#manual:');var lines=textToLines($('s-cleanips').value).filter(function(l){return l.split('#')[0].trim()!==r.entry.addrPart;});lines.push(r.entry.rawLine);$('s-cleanips').value=lines.join('\n');add.disabled=true;add.innerHTML=svgIcon('check','ic-sm')+' ADDED';};item.appendChild(add);}
    r.element=item;var box=$('scan-results');box.appendChild(item);while(box.children.length>400)box.firstElementChild.remove();updateScanSummary(false);
  }
  async function calibrateScanner(){
    $('scan-control').hidden=false;$('scan-control').textContent=tr('بررسی مسیر اینترنت شما…','Checking your network…');
    var signal=scannerController.signal,N=globalThis.NLNetwork,control=await N.sample('/api/ping',{check:'health',credentials:'same-origin',timeout:3000,signal:signal},3);
    $('scan-control').textContent=control.ok?'HTTP '+control.ms+' ms · '+tr('پاسخ پنل؛ مستقل از IPها','panel response, separate from candidate IPs'):tr('پاسخ پنل پایدار نبود','Panel response was unstable');
    scanCalibration=await N.scannerCalibration({baseMs:control.ms||100,timeout:Number($('scan-timeout').value),signal:signal});
    $('scan-calibration').hidden=false;$('scan-calibration').textContent=scanCalibration.heuristicAllowed?tr('سبز: پاسخ واقعی · زرد: نامزد تخمینی · قرمز: پایان مهلت بدون پاسخ · خاکستری: نامشخص','Green: actual response · amber: candidate · red: timeout · gray: unknown'):tr('پاسخ به آدرس کنترل دیده شد؛ سیگنال‌های خطا، نامزد سالم اعلام نمی‌شوند.','Control addresses reacted; error signals are not treated as healthy candidates.');
  }
  async function probeBatch(entries,concurrency){
    return globalThis.NLNetwork.bounded(entries.filter(function(e){return [443,2053,2083,2087,2096,8443].indexOf(e.port)>=0;}),concurrency,async function(entry){
      var r=await globalThis.NLNetwork.cleanProbe(entry,{calibration:scanCalibration,timeout:Number($('scan-timeout').value),signal:scannerController.signal});r.entry=entry;r.responseMs=r.ms;r.sortMs=r.ok?r.ms:r.candidate?10000+r.candidateMs:999999;appendScanResult(r);return r;
    },scannerController.signal);
  }
  function beginScan(range,goal){scannerController=new AbortController();scanCalibration=null;scanRangeMode=range;scanGoal=goal;scanCounts={tested:0,http:0,candidates:0,timeouts:0};lastUserScanCandidates=[];scanBusy(true);$('btn-prune-clean').hidden=true;$('scan-results').hidden=false;$('scan-results').innerHTML='';$('scan-summary').hidden=false;updateScanSummary(false);}
  $('btn-scan-user-list').onclick=async function(){
    if(scannerRunning)return;var entries=textToLines($('s-cleanips').value).map(parseUserCleanLine).filter(Boolean);if(!entries.length){showToast('ابتدا فهرست را وارد کنید','Enter a list first');return;}
    beginScan(false,entries.length);try{await calibrateScanner();for(var i=0;i<entries.length&&!scannerController.signal.aborted;i+=32){var results=await probeBatch(entries.slice(i,i+32),Number($('scan-parallel').value));if($('scan-geo').checked)await enrichScanCountries(results,false);}if(!scannerController.signal.aborted)$('s-cleanips').value=entries.map(function(e){return e.rawLine;}).join('\n');}catch(e){if(!scannerController.signal.aborted)showToast('آزمون ناقص ماند؛ فهرست حفظ شد','Incomplete; list retained');}finally{$('btn-prune-clean').hidden=!lastUserScanCandidates.length;updateScanSummary(scannerController.signal.aborted);scanBusy(false);}
  };
  $('btn-prune-clean').onclick=function(){var priority=new Set(lastUserScanCandidates.map(function(r){return r.entry.addrPart;})),first=[],rest=[];textToLines($('s-cleanips').value).forEach(function(line){(priority.has(line.split('#')[0].trim())?first:rest).push(line);});$('s-cleanips').value=first.concat(rest).join('\n');showToast('اولویت‌بندی بدون حذف؛ برای انتشار ذخیره کنید','Prioritized without removal; save to publish');};
  $('btn-country-list').onclick=async function(){if(scannerRunning)return;var entries=textToLines($('s-cleanips').value).map(parseUserCleanLine).filter(Boolean);scannerController=new AbortController();scanBusy(true);try{await enrichScanCountries(entries.map(function(e){return {entry:e};}),true);if(!scannerController.signal.aborted)$('s-cleanips').value=entries.map(function(e){return e.rawLine;}).join('\n');showToast('برچسب‌ها بازبینی شدند؛ مکان لبهٔ Anycast از GeoIP معلوم نمی‌شود. برای انتشار ذخیره کنید.','GeoIP labels reviewed, not physical anycast locations. Save to publish.');}catch(e){showToast('دریافت کشور کامل نشد؛ نتیجهٔ نامعلوم ساخته نشد','Country lookup incomplete; no guessed location');}finally{scanBusy(false);}};
  $('btn-scan-clean').onclick=async function(){if(scannerRunning)return;this.disabled=true;try{var data=await api('/api/cf/ip-ranges');if(!data||!Array.isArray(data.ipv4)||!Array.isArray(data.ipv6))throw Error('ranges');officialRanges=data;$('cf-range-list').innerHTML='';var total=0;data.ipv4.concat(data.ipv6).forEach(function(cidr,i){var v4=i<data.ipv4.length,bits=Number(cidr.split('/')[1]),size=v4?Math.pow(2,32-bits):null;if(v4)total+=size;var row=document.createElement('label');row.className='range-row';row.innerHTML='<input type="checkbox" class="range-select" '+(i<3?'checked':'')+' data-cidr="'+esc(cidr)+'" data-family="'+(v4?4:6)+'"><span class="range-key mono" dir="ltr">'+esc(cidr)+'</span><span class="range-count mono">'+(v4?size.toLocaleString('en-US'):'2^'+(128-bits))+' IP</span>';$('cf-range-list').appendChild(row);});$('cf-ranges-total').textContent=data.ipv4.length+' IPv4 + '+data.ipv6.length+' IPv6 · '+total.toLocaleString('en-US')+' IPv4 IPs';$('cf-ranges-panel').hidden=false;}catch(e){showToast('دریافت فهرست رسمی ناموفق بود','Official range feed unavailable');}finally{this.disabled=false;}};
  ['all','v4','v6','none'].forEach(function(kind){$('ranges-'+kind).onclick=function(){$('cf-range-list').querySelectorAll('.range-select').forEach(function(input){input.checked=kind==='all'||kind==='v4'&&input.dataset.family==='4'||kind==='v6'&&input.dataset.family==='6';});};});
  $('btn-scan-ranges').onclick=async function(){
    if(!officialRanges||scannerRunning)return;var choices=Array.from($('cf-range-list').querySelectorAll('.range-select:checked'));if(!choices.length){showToast('حداقل یک رنج انتخاب کنید','Select a range');return;}
    var budget=$('scan-budget').value==='continuous'?Infinity:Number($('scan-budget').value),iterators=choices.map(function(c){return globalThis.NLNetwork.cidrIterator(c.dataset.cidr);}),cursor=0,issued=0;
    beginScan(true,budget);try{await calibrateScanner();while(issued<budget&&iterators.length&&!scannerController.signal.aborted){var chunk=[];while(chunk.length<32&&issued<budget&&iterators.length){cursor%=iterators.length;var ip=iterators[cursor].next();if(ip===null){iterators.splice(cursor,1);continue;}cursor++;issued++;chunk.push(parseUserCleanLine(ip+'#CF-Scan'));}var results=await probeBatch(chunk,Number($('scan-parallel').value));if($('scan-geo').checked)await enrichScanCountries(results,false);await new Promise(function(r){setTimeout(r,0);});}}catch(e){if(!scannerController.signal.aborted)showToast('اسکن کامل نشد؛ نتایج دریافت‌شده حفظ شدند','Scan incomplete; received results retained');}finally{updateScanSummary(scannerController.signal.aborted);scanBusy(false);}
  };

  $('btn-test-proxyip').onclick = async function () {
    var first = textToLines($('s-proxyips').value)[0] || '';
    if (!first) { showToast('ابتدا یک ProxyIP وارد کن', 'Enter a ProxyIP first'); return; }
    $('proxyip-res').textContent = 'TESTING…';
    try {
      var r = await api('/api/test-proxyip', 'POST', { target: first });
      $('proxyip-res').textContent = r.ok ? ('OK · ' + r.latencyMs + ' ms') : ('ERR · ' + r.error);
    } catch (e) {
      $('proxyip-res').textContent = 'ERR · ' + e.message;
    }
  };

  $('btn-test-chain').onclick = async function () {
    var target = $('s-chain').value.trim();
    if (!target) { showToast('آدرس پروکسی زنجیره‌ای خالی است', 'Enter chain proxy URL'); return; }
    try {
      var r = await api('/api/test-proxyip', 'POST', { target: target,kind:'chain' });
      if (r.ok) showToast('احراز هویت و CONNECT به 443 از Worker موفق بود؛ اتصال کلاینت را هم تست کنید (' + r.latencyMs + 'ms)', 'Chain OK (' + r.latencyMs + 'ms)');
      else showToast('خطا: ' + r.error, 'Failed: ' + r.error);
    } catch (e) {
      showToast(e.message, e.message);
    }
  };

  $('f-pass').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    try {
      await api('/api/password', 'POST', {
        currentPassword: $('pw-cur').value,
        newPassword: $('pw-new').value
      });
      $('pw-cur').value = '';
      $('pw-new').value = '';
      showToast('رمز عبور با موفقیت تغییر یافت', 'Password updated');
    } catch (err) {
      showToast(err.message, err.message);
    }
  });

  $('btn-export').onclick = async function () {
    try {
      var data = await api('/api/backup', 'GET');
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var objUrl = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = objUrl;
      a.download = 'arenapanel-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { try { URL.revokeObjectURL(objUrl); } catch (e) {} }, 2500);
      showToast('فایل پشتیبان دانلود شد', 'Backup downloaded');
    } catch (err) {
      showToast(err.message, err.message);
    }
  };

  $('inp-import').addEventListener('change', function (ev) {
    var file = ev.target.files && ev.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onerror = function () {
      showToast('خطا در خواندن فایل پشتیبان', 'Failed to read backup file');
      ev.target.value = '';
    };
    reader.onload = async function () {
      try {
        var parsed = JSON.parse(String(reader.result || '{}'));
        var res = await api('/api/restore', 'POST', parsed);
        ingestBootstrap(res);
        showToast('پشتیبان با موفقیت بازیابی شد', 'Backup restored');
      } catch (err) {
        showToast('خطا در بازیابی: ' + err.message, 'Restore error: ' + err.message);
      }
      ev.target.value = '';
    };
    reader.readAsText(file);
  });

  function renderActivityLogs() {
    var box = $('logs-list');
    box.innerHTML = '';
    if (!STATE.logs.length) {
      box.innerHTML = '<div class="node-row"><span class="mono sm">NO LOGS YET</span></div>';
      return;
    }
    STATE.logs.forEach(function (l) {
      var row = document.createElement('div');
      row.className = 'node-row';
      var dt = new Date(l.ts).toISOString().replace('T', ' ').slice(0, 19);
      row.innerHTML = '<span class="mono sm">' + esc(dt) + ' · [' + esc(l.event) + ']</span><span>' + esc(l.detail) + '</span>';
      box.appendChild(row);
    });
  }

  /* ------ Cloudflare Daily Request Quota Bar & Hardcoded GitHub Updater --- */

  var cfUsageFetching = false;
  var ghChecking = false;

  function inferHostWorkerName() {
    var h = String(STATE.host || location.hostname || '').split(':')[0].toLowerCase();
    if (h.slice(-12) === '.workers.dev') {
      var p = h.split('.');
      if (p.length >= 4) return p[0];
    }
    return '';
  }

  function formatResetRemain(sec) {
    var s = Math.max(0, Number(sec) || 0);
    var hh = Math.floor(s / 3600);
    var mm = Math.floor((s % 3600) / 60);
    return tr('ریست سهمیه: ' + hh + 'س ' + mm + 'د', 'Reset in ' + hh + 'h ' + mm + 'm');
  }

  function syncCfQuotaUI() {
    var cfg = STATE.cfIntegration || {};
    var u = STATE.cfUsage;
    var miniBar = $('cf-mini-bar');
    var miniTxt = $('cf-mini-txt');
    var modalBar = $('cf-modal-bar');
    var modalNums = $('cf-modal-nums');
    var modalAcc = $('cf-modal-acc');
    var modalReset = $('cf-modal-reset');

    if (!cfg.hasToken) {
      if (miniBar) miniBar.style.width = '0%';
      if (miniTxt) miniTxt.textContent = tr('تنظیم توکن', 'SET TOKEN');
      if (modalBar) modalBar.style.width = '0%';
      if (modalNums) modalNums.textContent = '0 / 100,000 (0%)';
      if (modalAcc) modalAcc.textContent = tr('توکن کلادفلر هنوز ثبت نشده است', 'Cloudflare API token not set');
      if (modalReset) modalReset.textContent = 'UTC 00:00';
      if ($('btn-cf-clear')) $('btn-cf-clear').hidden = true;
      if ($('gh-token-hint')) $('gh-token-hint').textContent = tr('تنظیم توکن کلادفلر', 'Set CF Token');
      return;
    }

    if ($('btn-cf-clear')) $('btn-cf-clear').hidden = false;
    if ($('gh-token-hint')) {
      $('gh-token-hint').textContent = cfg.canEditWorkers
        ? tr('توکن آماده بروزرسانی خودکار', 'CF Token Ready')
        : tr('توکن متصل (ویرایش توکن)', 'CF Token Set');
    }

    if (!u) {
      if (miniBar) miniBar.style.width = '0%';
      if (miniTxt) miniTxt.textContent = '...';
      if (modalAcc) modalAcc.textContent = (cfg.accountName || cfg.accountId || 'Cloudflare');
      return;
    }

    var lim = Math.max(1000, Number(u.dailyLimit || cfg.dailyLimit) || 100000);
    var used = Math.max(0, Number(u.usedToday) || 0);
    var pct = used <= 0 ? 0 : Math.min(100, Math.max(1, Math.round((used / lim) * 100)));
    var pctExact = Math.min(100, Math.round((used / lim) * 1000) / 10);

    if (miniBar) {
      miniBar.style.width = pct + '%';
      if (miniBar.parentElement) miniBar.parentElement.classList.toggle('warn', pct >= 85);
    }
    if (miniTxt) {
      miniTxt.textContent = formatCompactCount(used) + '/' + formatCompactCount(lim);
    }
    if (modalBar) {
      modalBar.style.width = pct + '%';
      if (modalBar.parentElement) modalBar.parentElement.classList.toggle('warn', pct >= 85);
    }
    if (modalNums) {
      modalNums.textContent = used.toLocaleString('en-US') + ' / ' + lim.toLocaleString('en-US') + ' (' + pctExact + '%)';
    }
    if (modalAcc) {
      var accLabel = cfg.accountName || cfg.accountId || 'Cloudflare';
      if (cfg.scriptName) accLabel += ' · ' + cfg.scriptName;
      modalAcc.textContent = accLabel;
    }
    if (modalReset) {
      modalReset.textContent = formatResetRemain(u.resetInSec);
    }
  }

  async function refreshCfDailyUsage(forceFresh) {
    if (cfUsageFetching) return;
    cfUsageFetching = true;
    try {
      var res = await api('/api/cf/usage' + (forceFresh ? '?fresh=1' : ''), 'GET');
      if (res && res.cfIntegration) STATE.cfIntegration = res.cfIntegration;
      if (res && res.ok && res.usage) {
        STATE.cfUsage = res.usage;
      }
      syncCfQuotaUI();
      if (forceFresh && res && res.ok) {
        showToast('آمار روزانه کلادفلر بروز شد', 'Cloudflare daily quota refreshed');
      }
    } catch (err) {
      if (forceFresh) showToast(err.message, err.message);
    } finally {
      cfUsageFetching = false;
    }
  }

  function showCfMessage(text, isOk) {
    var box = $('cf-verify-msg');
    if (!box) return;
    if (!text) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    box.className = isOk ? 'ok-msg' : 'err';
    box.textContent = text;
    box.hidden = false;
  }

  function openCfModal() {
    var modal = $('cf-modal');
    if (!modal) return;
    var cfg = STATE.cfIntegration || {};
    showCfMessage('', false);
    if ($('cf-perm-popover')) $('cf-perm-popover').hidden = true;
    if ($('cf-inp-token')) {
      $('cf-inp-token').value = '';
      $('cf-inp-token').placeholder = cfg.hasToken
        ? (cfg.maskedToken + ' (' + tr('ذخیره شده — برای تغییر وارد کنید', 'saved — type to replace') + ')')
        : 'Paste Cloudflare API Token...';
    }
    if ($('cf-inp-script')) {
      $('cf-inp-script').value = cfg.scriptName || inferHostWorkerName();
    }
    if ($('cf-inp-limit')) {
      $('cf-inp-limit').value = String(cfg.dailyLimit || 100000);
    }
    syncCfQuotaUI();
    modal.hidden = false;
  }

  if ($('btn-cf-quota')) $('btn-cf-quota').onclick = openCfModal;
  if ($('btn-cf-close')) $('btn-cf-close').onclick = function () { $('cf-modal').hidden = true; };
  if ($('cf-modal')) {
    $('cf-modal').addEventListener('click', function (ev) {
      if (ev.target === $('cf-modal')) $('cf-modal').hidden = true;
    });
  }
  if ($('btn-cf-guide-pop')) {
    $('btn-cf-guide-pop').onclick = function () {
      var p = $('cf-perm-popover');
      if (p) p.hidden = !p.hidden;
    };
  }
  if ($('btn-cf-guide-close')) {
    $('btn-cf-guide-close').onclick = function () {
      if ($('cf-perm-popover')) $('cf-perm-popover').hidden = true;
    };
  }
  if ($('btn-cf-refresh')) {
    $('btn-cf-refresh').onclick = function () {
      refreshCfDailyUsage(true);
    };
  }

  async function submitCfTokenAction(actionMode) {
    var rawTok = ($('cf-inp-token') ? $('cf-inp-token').value : '').trim();
    var cfg = STATE.cfIntegration || {};
    var tokToSend = rawTok || (cfg.hasToken ? '__SAVED__' : '');
    if (!tokToSend) {
      showCfMessage(tr('ابتدا توکن API کلادفلر را وارد کنید.', 'Please enter your Cloudflare API Token first.'), false);
      return;
    }
    var scriptName = ($('cf-inp-script') ? $('cf-inp-script').value : '').trim();
    var dailyLimit = Number($('cf-inp-limit') ? $('cf-inp-limit').value : 100000) || 100000;

    showCfMessage(tr('در حال استعلام و بررسی دسترسی‌های توکن از کلادفلر…', 'Verifying token & permissions with Cloudflare…'), true);
    try {
      var res = await api('/api/cf/config', 'POST', {
        action: actionMode,
        token: tokToSend,
        scriptName: scriptName,
        dailyLimit: dailyLimit
      });
      if (res.cfIntegration) STATE.cfIntegration = res.cfIntegration;
      if (res.usage) STATE.cfUsage = res.usage;
      if (res.scriptName && $('cf-inp-script')) $('cf-inp-script').value = res.scriptName;
      if ($('cf-inp-token')) $('cf-inp-token').value = '';
      syncCfQuotaUI();

      var updPermTxt = res.canEditWorkers
        ? tr('فعال (آماده آپدیت خودکار)', 'Workers Edit: YES')
        : tr('فقط خواندن آمار', 'Analytics Read-Only');
      showCfMessage(
        tr(
          (actionMode === 'save' ? 'توکن ذخیره شد · اکانت: ' : 'اتصال برقرار است · اکانت: ') +
            (res.accountName || res.accountId || 'OK') +
            ' · مجوز: ' + updPermTxt,
          (actionMode === 'save' ? 'Token saved · Account: ' : 'Verified · Account: ') +
            (res.accountName || res.accountId || 'OK') +
            ' · ' + updPermTxt
        ),
        true
      );
      if (actionMode === 'save') {
        showToast('توکن کلادفلر متصل و ذخیره شد', 'Cloudflare token saved');
      }
    } catch (err) {
      showCfMessage(err.message, false);
    }
  }

  if ($('btn-cf-verify')) {
    $('btn-cf-verify').onclick = function () { submitCfTokenAction('verify'); };
  }
  if ($('btn-cf-save')) {
    $('btn-cf-save').onclick = function () { submitCfTokenAction('save'); };
  }
  if ($('btn-cf-clear')) {
    $('btn-cf-clear').onclick = async function () {
      try {
        var res = await api('/api/cf/config', 'POST', { action: 'clear' });
        STATE.cfIntegration = res.cfIntegration || { hasToken: false };
        STATE.cfUsage = null;
        if ($('cf-inp-token')) $('cf-inp-token').value = '';
        syncCfQuotaUI();
        showCfMessage(tr('توکن از حافظهٔ پنل پاک شد.', 'Token removed from panel.'), true);
        showToast('توکن کلادفلر حذف شد', 'Cloudflare token removed');
      } catch (err) {
        showCfMessage(err.message, false);
      }
    };
  }

  // Refresh Cloudflare quota every 3 minutes when Admin panel is open and token is configured
  setInterval(function () {
    if (STATE.mode !== 'admin' || document.hidden) return;
    if (STATE.cfIntegration && STATE.cfIntegration.hasToken) {
      refreshCfDailyUsage(false);
    }
  }, 180000);

  /* -------- ArenaPanel GitHub Updater (https://github.com/MrIranMa/panel) -------- */

  var ghAutoStarted=false,ghLastCheck=0;
  setInterval(function(){if(STATE.mode==='admin'&&!document.hidden)checkGitHubUpdates(true);},900000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&STATE.mode==='admin'&&Date.now()-ghLastCheck>900000)checkGitHubUpdates(true);});
  function syncGhUpdaterUI(ver) {
    var curV = ver || (STATE.ghInfo && STATE.ghInfo.currentVersion) || '2.5.8';
    if ($('gh-mini-ver')) $('gh-mini-ver').textContent = 'V' + curV;
    if ($('gh-cur-ver')) $('gh-cur-ver').textContent = 'V' + curV;
    if($('btn-gh-updater')){$('btn-gh-updater').classList.toggle('update-ready',!!(STATE.ghInfo&&STATE.ghInfo.updateAvailable));$('btn-gh-updater').setAttribute('aria-label',STATE.ghInfo&&STATE.ghInfo.updateAvailable?tr('نسخه جدید آماده است','New version available'):tr('بررسی بروزرسانی','Check for updates'));}
    if ($('gh-upd-dot')) {
      $('gh-upd-dot').hidden = !(STATE.ghInfo && STATE.ghInfo.updateAvailable);
    }
  }

  function showGhMessage(text, isOk) {
    var box = $('gh-msg');
    if (!box) return;
    if (!text) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    box.className = isOk ? 'ok-msg' : 'err';
    box.textContent = text;
    box.hidden = false;
  }

  async function checkGitHubUpdates(silentToast) {
    if (ghChecking) return;
    ghChecking = true;ghLastCheck=Date.now();
    var bdg = $('gh-status-badge');
    if (bdg) {
      bdg.className = 'badge';
      bdg.textContent = tr('در حال بررسی…', 'CHECKING…');
    }
    try {
      var res = await api('/api/update/check', 'GET');
      STATE.ghInfo = res;
      syncGhUpdaterUI(res.currentVersion);

      if ($('gh-rem-ver')) {
        $('gh-rem-ver').textContent = res.latestVersion ? ('V' + res.latestVersion) : '—';
      }
      if ($('gh-dl-link') && res.releaseUrl) {
        $('gh-dl-link').href = res.releaseUrl;
      }
      if ($('gh-notes-box')) {
        if (res.releaseNotes && res.releaseNotes.trim()) {
          $('gh-notes-box').textContent = res.releaseNotes.trim();
          $('gh-notes-box').hidden = false;
        } else {
          $('gh-notes-box').hidden = true;
        }
      }
      if ($('gh-inp-script') && !($('gh-inp-script').value || '').trim() && res.scriptName) {
        $('gh-inp-script').value = res.scriptName;
      }

      if (bdg) {
        if (res.notPublishedYet) {
          bdg.className = 'badge';
          bdg.textContent = tr('مخزن آماده انتشار', 'AWAITING RELEASE');
        } else if (res.updateAvailable) {
          bdg.className = 'badge inv';
          bdg.textContent = tr('نسخهٔ جدید آماده نصب', 'UPDATE AVAILABLE');
        } else {
          bdg.className = 'badge ok';
          bdg.textContent = tr('به‌روز است', 'UP TO DATE');
        }
      }
      if (!silentToast) {
        if (res.updateAvailable) {
          showToast('نسخهٔ جدید V' + res.latestVersion + ' یافت شد', 'Update V' + res.latestVersion + ' available');
        } else {
          showToast('پنل به آخرین نسخه مجهز است', 'Already on latest version');
        }
      }
    } catch (err) {
      if (bdg) {
        bdg.className = 'badge bad';
        bdg.textContent = tr('خطا در اتصال', 'CHECK FAILED');
      }
      if(!silentToast)showGhMessage(err.message, false);
    } finally {
      ghChecking = false;
    }
  }

  function openGhModal() {
    var modal = $('gh-modal');
    if (!modal) return;
    showGhMessage('', false);
    var cfg = STATE.cfIntegration || {};
    if ($('gh-inp-script') && !($('gh-inp-script').value || '').trim()) {
      $('gh-inp-script').value = cfg.scriptName || inferHostWorkerName();
    }
    syncCfQuotaUI();
    modal.hidden = false;
    if (!STATE.ghInfo) {
      checkGitHubUpdates(true);
    }
  }

  if ($('btn-gh-updater')) $('btn-gh-updater').onclick = openGhModal;
  if ($('btn-gh-close')) $('btn-gh-close').onclick = function () { $('gh-modal').hidden = true; };
  if ($('gh-modal')) {
    $('gh-modal').addEventListener('click', function (ev) {
      if (ev.target === $('gh-modal')) $('gh-modal').hidden = true;
    });
  }
  if ($('btn-gh-open-cf')) {
    $('btn-gh-open-cf').onclick = function () {
      $('gh-modal').hidden = true;
      openCfModal();
    };
  }
  if ($('btn-gh-check')) {
    $('btn-gh-check').onclick = function () {
      showGhMessage('', false);
      checkGitHubUpdates(false);
    };
  }
  if ($('btn-gh-apply')) {
    $('btn-gh-apply').onclick = async function () {
      var cfg = STATE.cfIntegration || {};
      if (!cfg.hasToken) {
        showGhMessage(
          tr(
            'برای بروزرسانی خودکار از داخل پنل، ابتدا روی «تنظیم توکن کلادفلر» بزنید و توکن دارای مجوز Workers Scripts: Edit را ثبت کنید.',
            'Please configure a Cloudflare API Token (with Workers Scripts: Edit permission) first.'
          ),
          false
        );
        return;
      }
      var targetScript = ($('gh-inp-script') ? $('gh-inp-script').value : '').trim();
      var btn = $('btn-gh-apply');
      btn.disabled = true;
      showGhMessage(
        tr(
          'در حال دریافت بستهٔ ArenaPanel از github.com/MrIranMa/panel و استقرار روی ورکر کلادفلر (حفظ کامل KV و مشترکین)…',
          'Downloading ArenaPanel bundle from github.com/MrIranMa/panel & deploying to Cloudflare Worker…'
        ),
        true
      );
      try {
        var res = await api('/api/update/apply', 'POST', { scriptName: targetScript });
        showGhMessage(
          tr(
            'هستهٔ پنل با موفقیت به نسخهٔ V' + res.targetVersion + ' بروزرسانی شد! در حال بارگذاری مجدد…',
            'Successfully updated Worker "' + res.scriptName + '" to V' + res.targetVersion + '! Reloading…'
          ),
          true
        );
        showToast('بروزرسانی با موفقیت انجام شد', 'Self-update deployed');
        setTimeout(function () {
          location.reload();
        }, res.reloadAfterMs || 2200);
      } catch (err) {
        showGhMessage(err.message, false);
      } finally {
        btn.disabled = false;
      }
    };
  }

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') {
      if ($('cf-modal') && !$('cf-modal').hidden) $('cf-modal').hidden = true;
      if ($('gh-modal') && !$('gh-modal').hidden) $('gh-modal').hidden = true;
    }
  });

  /* --------------------------------------------------------------- Boot */

  $('year').textContent = String(new Date().getFullYear());
  if (window.NIGHTLINE && window.NIGHTLINE.cf) {
    mergeVisitorCf(window.NIGHTLINE.cf);
  }
  applyAppearance();
  detectVisitorNetwork();
  requestAnimationFrame(drawMonochromeChartFrame);

  api('/api/bootstrap', 'GET')
    .then(ingestBootstrap)
    .catch(function () {
      $('diag-mode').textContent = 'OFFLINE';
      $('v-stateless').hidden = false;
      renderStatelessTicket();
    });
})();
