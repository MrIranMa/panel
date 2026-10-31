/* NIGHTLINE v2.5.1 — Complete Client Application (Vanilla ES6, zero external deps, zero emojis) */
(function () {
  'use strict';

  var OFFICIAL_GITHUB_REPO = 'youdidking/NightLine';
  var OFFICIAL_GITHUB_URL = 'https://github.com/youdidking/NightLine';

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
    host: location.host || 'nightline.workers.dev',
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
      try { document.execCommand('copy'); done(); } catch (e) {}
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

  var ADV_TARGETS = [
    { id: 'google', name: 'Google (204)', catFa: 'اینترنت پایه', catEn: 'Core Web', kind: 'core', url: 'https://www.gstatic.com/generate_204' },
    { id: 'cf_edge', name: 'Cloudflare Edge', catFa: 'شبکه کلادفلر', catEn: 'CF Anycast', kind: 'cf', url: 'https://cp.cloudflare.com/generate_204' },
    { id: 'cf_doh', name: 'Cloudflare DoH', catFa: 'DNS رمزنگاری', catEn: 'Secure DoH', kind: 'doh', url: 'https://cloudflare-dns.com/dns-query?name=example.com&type=A', corsJson: true },
    { id: 'chatgpt', name: 'ChatGPT (OpenAI)', catFa: 'هوش مصنوعی', catEn: 'AI Platform', kind: 'ai', url: 'https://chatgpt.com/favicon.ico' },
    { id: 'claude', name: 'Claude AI', catFa: 'هوش مصنوعی', catEn: 'AI Platform', kind: 'ai', url: 'https://claude.ai/favicon.ico' },
    { id: 'gemini', name: 'Google Gemini', catFa: 'هوش مصنوعی', catEn: 'AI Platform', kind: 'ai', url: 'https://gemini.google.com/favicon.ico' },
    { id: 'github', name: 'GitHub', catFa: 'توسعه‌دهندگان', catEn: 'Dev & Code', kind: 'dev', url: 'https://github.githubassets.com/favicons/favicon.svg' },
    { id: 'youtube', name: 'YouTube', catFa: 'ویدیو و رسانه', catEn: 'Filtered Media', kind: 'social', url: 'https://www.youtube.com/favicon.ico' },
    { id: 'telegram', name: 'Telegram Web', catFa: 'پیام‌رسان', catEn: 'Messenger', kind: 'social', url: 'https://web.telegram.org/favicon.ico' },
    { id: 'x_social', name: 'X / Twitter', catFa: 'شبکه اجتماعی', catEn: 'Social Net', kind: 'social', url: 'https://abs.twimg.com/favicons/twitter.3.ico' },
    { id: 'cf_8443', name: 'CF TLS :8443', catFa: 'پورت جایگزین', catEn: 'Alt TLS Port', kind: 'port', port: 8443, url: 'https://www.speedtest.net:8443/cdn-cgi/trace' },
    { id: 'cf_2053', name: 'CF TLS :2053', catFa: 'پورت جایگزین', catEn: 'Alt TLS Port', kind: 'port', port: 2053, url: 'https://cp.cloudflare.com:2053/cdn-cgi/trace' }
  ];

  var lastAdvisorPatch = null;
  var advisorRunning = false;

  async function probeAdvisorTarget(t) {
    if (isSandboxPreview) {
      var blockedInIr = t.kind === 'social';
      return {
        target: t,
        ok: !blockedInIr,
        sanctioned: t.kind === 'ai' && STATE.cf.country === 'IR',
        ms: blockedInIr ? 3200 : (45 + Math.floor(Math.random() * 90))
      };
    }
    var timeoutMs = 3200;
    var ctrl = new AbortController();
    var tid = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, timeoutMs);
    var t0 = performance.now();
    try {
      var sep = t.url.indexOf('?') >= 0 ? '&' : '?';
      var fetchOpts = t.corsJson
        ? { mode: 'cors', headers: { accept: 'application/dns-json' }, cache: 'no-store', signal: ctrl.signal }
        : { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ctrl.signal };
      var resp = await fetch(t.url + sep + '_nl=' + Date.now(), fetchOpts);
      clearTimeout(tid);
      var ms = Math.max(1, Math.round(performance.now() - t0));
      if (t.corsJson && !resp.ok) return { target: t, ok: false, sanctioned: false, ms: ms };
      var isSanctioned = (t.kind === 'ai' && STATE.cf.country === 'IR');
      return { target: t, ok: true, sanctioned: isSanctioned, ms: ms };
    } catch (e) {
      clearTimeout(tid);
      return { target: t, ok: false, sanctioned: false, ms: timeoutMs };
    }
  }

  function renderAdvisorSkeleton() {
    var grid = $('adv-grid');
    if (!grid || grid.children.length > 0) return;
    ADV_TARGETS.forEach(function (t) {
      var cell = document.createElement('div');
      cell.className = 'adv-item';
      cell.id = 'adv-cell-' + t.id;
      cell.innerHTML =
        '<div class="adv-item-top">' +
          '<span class="adv-item-name">' + esc(t.name) + '</span>' +
          '<span class="badge mono" id="adv-bdg-' + t.id + '">READY</span>' +
        '</div>' +
        '<div class="adv-item-cat">' +
          '<span><span class="fa">' + esc(t.catFa) + '</span><span class="en">' + esc(t.catEn) + '</span></span>' +
          '<span class="mono" id="adv-ms-' + t.id + '">—</span>' +
        '</div>' +
        '<div class="adv-bar"><i id="adv-bar-' + t.id + '" style="width:0%"></i></div>';
      grid.appendChild(cell);
    });
  }

  async function runSmartAdvisor() {
    if (advisorRunning) return;
    advisorRunning = true;
    renderAdvisorSkeleton();
    var ic = $('adv-run-ic');
    if (ic) ic.classList.add('ic-spin');
    if ($('btn-adv-apply')) $('btn-adv-apply').hidden = true;

    ADV_TARGETS.forEach(function (t) {
      var b = $('adv-bdg-' + t.id);
      if (b) { b.className = 'badge mono'; b.textContent = 'TESTING'; }
    });

    var results = await Promise.all(ADV_TARGETS.map(probeAdvisorTarget));
    var byId = {};
    results.forEach(function (r) {
      byId[r.target.id] = r;
      var b = $('adv-bdg-' + r.target.id);
      var m = $('adv-ms-' + r.target.id);
      var bar = $('adv-bar-' + r.target.id);
      if (b) {
        if (!r.ok) {
          b.className = 'badge bad';
          b.textContent = tr('فیلتر / مسدود', 'FILTERED');
        } else if (r.sanctioned) {
          b.className = 'badge';
          b.textContent = tr('تحریم IP ایران', 'GEO-SANCTION');
        } else {
          b.className = 'badge ok';
          b.textContent = tr('باز · مستقیم', 'OPEN');
        }
      }
      if (m) m.textContent = r.ok ? (r.ms + ' ms') : 'TIMEOUT';
      if (bar) bar.style.width = r.ok ? Math.max(15, Math.min(100, Math.round(100 - (r.ms / 18)))) + '%' : '6%';
    });

    // Analyze ISP profile & build tailored prescription
    var socialBlocked = ['youtube', 'telegram', 'x_social'].filter(function (k) { return !byId[k] || !byId[k].ok; }).length;
    var aiBlocked = ['chatgpt', 'claude', 'gemini'].filter(function (k) { return !byId[k] || !byId[k].ok || byId[k].sanctioned; }).length;
    var cfDohOk = byId.cf_doh && byId.cf_doh.ok;
    var openPorts = [443];
    if (byId.cf_8443 && byId.cf_8443.ok) openPorts.push(8443);
    if (byId.cf_2053 && byId.cf_2053.ok) openPorts.push(2053);
    openPorts.push(2083, 2087, 2096);

    var hasDpiBlocking = socialBlocked >= 1;
    var hasAiRestriction = STATE.cf.country === 'IR' || aiBlocked >= 1;
    var ispLabelFa = STATE.cf.ispFa || 'اینترنت فعلی شما';
    var ispLabelEn = STATE.cf.ispEn || 'your current ISP';
    var isMobileIsp = /همراه اول|ایرانسل|رایتل|MCI|Irancell|Rightel/i.test(ispLabelFa + ' ' + ispLabelEn);

    var recsFa = [];
    var recsEn = [];

    if (hasDpiBlocking || STATE.cf.country === 'IR') {
      var fragMode = isMobileIsp ? '1-1' : 'tlshello';
      var fpRec = isMobileIsp ? 'randomized' : 'chrome';
      var statusDescFa = hasDpiBlocking
        ? ('فیلترینگ SNI/DPI فعال است (' + socialBlocked + ' از ۳ شبکهٔ اجتماعی مسدود و ' + aiBlocked + ' سرویس هوش مصنوعی محدود)')
        : ('مسیر پایه باز است امّا IP ایران و محدودیت تحریم/اپراتور تشخیص داده شد (' + aiBlocked + ' سرویس هوش مصنوعی نیازمند تونل)');
      var statusDescEn = hasDpiBlocking
        ? ('Active DPI/SNI filtering detected (' + socialBlocked + '/3 social networks blocked; ' + aiBlocked + ' AI services restricted)')
        : ('Core route reachable, but Iran IP geo-sanctions & ISP policies detected (' + aiBlocked + ' AI platforms require tunnel)');

      $('adv-verdict').innerHTML =
        '<span class="fa">نتیجهٔ تحلیل روی <strong>' + esc(ispLabelFa) + '</strong>: ' + esc(statusDescFa) + '.</span>' +
        '<span class="en">Diagnosis on <strong>' + esc(ispLabelEn) + '</strong>: ' + esc(statusDescEn) + '.</span>';

      recsFa.push('سایت‌های پایه (گوگل و کلادفلر) روی خط شما در دسترس‌اند؛ برای باز شدن بدون خطای ChatGPT، Claude و Gemini حتماً «عبور اجباری سرویس‌های تحریمی و هوش مصنوعی» فعال بماند.');
      recsFa.push('برای اپراتور «' + ispLabelFa + '»، فعال‌سازی Fragment در حالت ' + fragMode + ' (طول 10-20) به‌همراه اثرانگشت TLS «' + fpRec + '» و «مسدودسازی QUIC» بیشترین پایداری و کمترین پینگ را می‌دهد.');
      recsFa.push(cfDohOk
        ? 'سرور Cloudflare DoH روی خط شما باز است (' + byId.cf_doh.ms + 'ms) و «Private DoH اختصاصی ورکر» نیز از شنود یا مسمومیت DNS جلوگیری کامل می‌کند.'
        : 'دسترسی مستقیم به Cloudflare DoH روی اپراتور شما محدود است؛ گزینهٔ «Private DoH اختصاصی روی همین ورکر» را فعال نگه دارید.');

      recsEn.push('Google & Cloudflare Anycast reach your browser; keep "Force Sanctioned / AI Domains via Tunnel" enabled for ChatGPT, Claude, and Gemini.');
      recsEn.push('For ' + ispLabelEn + ', enabling Fragment (' + fragMode + ', length 10-20), uTLS "' + fpRec + '", and Block QUIC prevents TLS resets.');
      recsEn.push('Private Worker DoH (/dns-query/<token>) eliminates DNS poisoning on this network.');

      lastAdvisorPatch = {
        enableFragment: true,
        fragmentPackets: fragMode,
        fragmentLength: '10-20',
        fragmentInterval: '10-20',
        fingerprint: fpRec,
        blockQuic: true,
        bypassIran: true,
        sanctionBypass: true,
        remoteDnsMode: 'private-doh',
        tlsPorts: openPorts
      };
    } else if (hasAiRestriction) {
      $('adv-verdict').innerHTML =
        '<span class="fa">نتیجهٔ تحلیل روی <strong>' + esc(ispLabelFa) + '</strong>: شبکه‌های اجتماعی باز هستند امّا برخی سرویس‌های هوش مصنوعی محدودیت دسترسی دارند.</span>' +
        '<span class="en">Diagnosis on <strong>' + esc(ispLabelEn) + '</strong>: Social media opens directly, while ' + aiBlocked + ' AI endpoint(s) require tunnel routing.</span>';

      recsFa.push('گوگل، یوتیوب، تلگرام و X مستقیماً روی اینترنت شما باز هستند و نیازی به Fragment سنگین نیست.');
      recsFa.push('گزینهٔ «عبور اجباری سرویس‌های تحریمی و هوش مصنوعی» را روشن بگذارید تا ChatGPT و Claude از تونل کلادفلر عبور کنند.');
      recsEn.push('Google, YouTube, Telegram, and X open directly — heavy TLS Fragmentation is not required.');
      recsEn.push('Keep Sanction/AI Bypass enabled so AI platforms route seamlessly via NIGHTLINE.');

      lastAdvisorPatch = {
        enableFragment: false,
        fingerprint: 'chrome',
        blockQuic: false,
        sanctionBypass: true,
        remoteDnsMode: cfDohOk ? 'cloudflare' : 'private-doh',
        tlsPorts: openPorts
      };
    } else {
      $('adv-verdict').innerHTML =
        '<span class="fa">نتیجهٔ تحلیل روی <strong>' + esc(ispLabelFa) + '</strong>: اینترنتِ شما آزاد و بدون فیلترینگ شدید DPI است (اکثر سرویس‌ها و هوش مصنوعی مستقیم باز می‌شوند).</span>' +
        '<span class="en">Diagnosis on <strong>' + esc(ispLabelEn) + '</strong>: Unrestricted connection detected — Google, AI platforms, and social media open directly with low latency.</span>';

      recsFa.push('گوگل، یوتیوب، تلگرام و پلتفرم‌های هوش مصنوعی مستقیماً از مرورگر شما باز هستند (' + (aiBlocked === 0 ? 'بدون تحریم IP' : 'برخی نیازمند تونل') + ').');
      recsFa.push('روی این اینترنت نیازی به تکه کردن بسته‌ها (Fragment شدید) نیست؛ خاموش گذاشتن Fragment یا حالت ملایم باعث حداکثر سرعت دانلود و پینگ پایین‌تر می‌شود.');
      recsFa.push('پورت‌های چندگانهٔ TLS کلادفلر (' + openPorts.slice(0, 3).join(', ') + ') باز هستند و می‌توانند برای مشترکین در اشتراک قرار گیرند.');

      recsEn.push('Direct access to Google, YouTube, Telegram, and AI platforms is healthy from this browser.');
      recsEn.push('Heavy TLS Fragmentation is unnecessary on this ISP — disabling Fragment maximizes raw WebSocket throughput.');
      recsEn.push('Cloudflare multi-port TLS (' + openPorts.slice(0, 3).join(', ') + ') and Cloudflare DoH are reachable.');

      lastAdvisorPatch = {
        enableFragment: false,
        fingerprint: 'chrome',
        blockQuic: false,
        sanctionBypass: true,
        remoteDnsMode: cfDohOk ? 'cloudflare' : 'private-doh',
        tlsPorts: openPorts
      };
    }

    var ul = $('adv-recs');
    if (ul) {
      ul.hidden = false;
      ul.innerHTML = '';
      for (var i = 0; i < recsFa.length; i++) {
        var li = document.createElement('li');
        li.innerHTML = '<span class="fa">' + esc(recsFa[i]) + '</span><span class="en">' + esc(recsEn[i]) + '</span>';
        ul.appendChild(li);
      }
    }

    if ($('btn-adv-apply') && STATE.mode === 'admin') {
      $('btn-adv-apply').hidden = false;
    }

    advisorRunning = false;
    if (ic) ic.classList.remove('ic-spin');
  }

  if ($('btn-adv-run')) {
    $('btn-adv-run').addEventListener('click', runSmartAdvisor);
  }

  if ($('btn-adv-apply')) {
    $('btn-adv-apply').addEventListener('click', async function () {
      if (!lastAdvisorPatch || STATE.mode !== 'admin') return;
      try {
        var merged = Object.assign({}, collectSettingsFromForms(), lastAdvisorPatch);
        var res = await api('/api/settings', 'PUT', merged);
        ingestBootstrap(res);
        showToast('تنظیمات بهینهٔ اپراتور با موفقیت روی پنل اعمال شد', 'Optimal ISP settings applied to panel');
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

  /* -------------------------------------------- Appearance & Free Modal */

  function applyAppearance() {
    html.setAttribute('data-lang', lang);
    html.setAttribute('lang', lang === 'fa' ? 'fa' : 'en');
    html.setAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr');
    html.setAttribute('data-theme', theme);
    $('lang').textContent = lang === 'fa' ? 'EN' : 'FA';
    document.querySelectorAll('.t-pick').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-th') === theme);
    });
    renderVisitorStrip();
    if (STATE.currentQrText) drawQrInto('main-qr', STATE.currentQrText);
    renderStatelessTicket();
    if (STATE.mode === 'admin') {
      renderAdminHeader();
      renderActiveUserPass();
      renderUsersLedger();
      syncCfQuotaUI();
    }
  }

  $('lang').addEventListener('click', function () {
    lang = lang === 'fa' ? 'en' : 'fa';
    LS.set('lang', lang);
    applyAppearance();
  });

  document.querySelectorAll('.t-pick').forEach(function (btn) {
    btn.addEventListener('click', function () {
      theme = btn.getAttribute('data-th') === 'dark' ? 'dark' : 'light';
      LS.set('theme', theme);
      applyAppearance();
    });
  });

  var freeModal = $('free-notice-modal');
  var freeInfoBtn = $('btn-free-info');
  var freeCloseBtn = $('btn-free-close');
  function closeFreeModal() {
    if (freeModal) freeModal.hidden = true;
    try { sessionStorage.setItem('nl.free.seen', '1'); } catch (e) {}
  }
  if (freeInfoBtn && freeModal) {
    freeInfoBtn.addEventListener('click', function () { freeModal.hidden = false; });
  }
  if (freeCloseBtn) {
    freeCloseBtn.addEventListener('click', closeFreeModal);
  }
  if (freeModal) {
    freeModal.addEventListener('click', function (ev) {
      if (ev.target === freeModal) closeFreeModal();
    });
    try {
      if (!sessionStorage.getItem('nl.free.seen') && location.search.indexOf('nopopup=1') === -1) {
        freeModal.hidden = false;
      }
    } catch (e) {}
  }

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
      version: '2.5.1',
      mode: 'admin', kvBound: true, kvName: 'PREVIEW_KV', initialized: true, authenticated: true,
      edge: 'FRA', host: 'nightline.example.workers.dev',
      cfIntegration: {
        hasToken: true,
        maskedToken: '••••••••9f2a',
        accountId: 'demo_acc_01',
        accountName: 'Cloudflare Edge Account',
        scriptName: 'nightline',
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
        cleanIPs: ['www.speedtest.net#Speedtest', '172.67.73.163#CF-MCI'],
        customDomains: [],
        proxyIPs: ['ProxyIP.NL.CMLiussss.net', 'ProxyIP.DE.CMLiussss.net', 'ProxyIP.US.CMLiussss.net', 'nima.nscl.ir'],
        enableNAT64: true,
        nat64Prefixes: ['2a02:898:146:64::', '2602:fc59:b0:64::', '2602:fc59:11:64::'],
        chainProxy: '',
        enableTgProxy: true,
        tgProxySecret: '9f8e7d6c5b4a39281726354455667788',
        tgProxyDomain: '',
        enableFragment: true, fragmentPackets: '1-1', fragmentLength: '10-20', fragmentInterval: '10-20', enableNoise: false,
        upstreamDoH: 'https://1.1.1.1/dns-query', remoteDnsMode: 'private-doh', directDns: '8.8.8.8',
        bypassIran: true, bypassLAN: true, bypassChina: false, bypassRussia: false,
        blockQuic: true, blockAds: true, blockAdult: false, sanctionBypass: true,
        customDirectDomains: [], customProxyDomains: ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'docker.io', 'github.com'],
        customBlockDomains: [], showSubInfoNodes: true, rootMode: 'panel', fallbackDomain: ''
      },
      users: [u1, u2],
      logs: [
        { ts: Date.now() - 120000, event: 'setup', detail: 'پیش‌نمایش تعاملی پنل آماده است (V2.5.1)' },
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
        return { addr: p[0].trim(), label: (p[1] || p[0]).trim() };
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

  async function api(path, method, body) {
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
        ds.cfIntegration.scriptName = body.scriptName || 'nightline';
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
          currentVersion: '2.5.1',
          latestVersion: '2.5.1',
          updateAvailable: false,
          releaseUrl: OFFICIAL_GITHUB_URL + '/releases',
          releaseNotes: 'NIGHTLINE v2.5.1 — Latest release installed.',
          cfConfigured: ds.cfIntegration.hasToken,
          canEditWorkers: true,
          scriptName: ds.cfIntegration.scriptName || 'nightline'
        };
      }
      if (path === '/api/update/apply') {
        return {
          ok: true,
          updated: true,
          previousVersion: '2.5.1',
          targetVersion: '2.5.1',
          scriptName: (body && body.scriptName) || 'nightline',
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
    var tid = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 15000) : null;
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
    STATE.host = data.host || (data.cf && data.cf.host) || location.host || 'nightline.workers.dev';
    if (data.edge && data.edge !== 'CF-GLOBAL') STATE.edge = data.edge;
    else if (STATE.edge === '—' && data.edge) STATE.edge = data.edge;

    if (data.cf) mergeVisitorCf(data.cf);
    else renderVisitorStrip();

    $('mast-title').textContent = 'NIGHTLINE';

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
      if (STATE.cfIntegration && STATE.cfIntegration.hasToken && !STATE.cfUsage && !cfUsageFetching) {
        refreshCfDailyUsage(false);
      }

      if (data.initialNodes && STATE.users[0] && STATE.selectedUserId === STATE.users[0].id) {
        STATE.currentNodes = data.initialNodes;
        renderActiveUserPass();
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
    slUri = 'vless://' + id + '@' + h + ':443?encryption=none&security=tls&sni=' + h + '&fp=chrome&type=ws&host=' + h + '&path=%2F%3Fed%3D2048#NIGHTLINE';
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
    if (tabName === 'advisor') renderAdvisorSkeleton();
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
      STATE.currentNodes = res.nodes || [];
      renderActiveUserPass();
    } catch (e) {}
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

    var base = subBaseUrl(u);
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

  $('cp-b64').onclick = function () { var u = getSelectedUser(); if (u) copyText(subBaseUrl(u), 'لینک اشتراک عمومی', 'Normal Sub URL'); };
  $('cp-xray').onclick = function () { var u = getSelectedUser(); if (u) copyText(subBaseUrl(u) + '?format=xray', 'لینک اشتراک Fragment', 'Xray Fragment URL'); };
  $('cp-sb').onclick = function () { var u = getSelectedUser(); if (u) copyText(subBaseUrl(u) + '?format=singbox', 'لینک Sing-box / Hiddify', 'Sing-box URL'); };
  $('cp-clash').onclick = function () { var u = getSelectedUser(); if (u) copyText(subBaseUrl(u) + '?format=clash', 'لینک Clash / Mihomo', 'Clash URL'); };
  $('cp-doh').onclick = function () { var u = getSelectedUser(); if (u) copyText(dohFullUrl(u), 'آدرس DoH اختصاصی', 'Private DoH URL'); };

  $('qr-btn-b64').onclick = function () {
    var u = getSelectedUser(); if (!u) return;
    STATE.currentQrText = subBaseUrl(u);
    $('qr-caption').textContent = 'NORMAL SUBSCRIPTION';
    drawQrInto('main-qr', STATE.currentQrText);
  };
  $('qr-btn-xray').onclick = function () {
    var u = getSelectedUser(); if (!u) return;
    STATE.currentQrText = subBaseUrl(u) + '?format=xray';
    $('qr-caption').textContent = 'FRAGMENT SUB (XRAY JSON)';
    drawQrInto('main-qr', STATE.currentQrText);
  };
  $('qr-btn-sb').onclick = function () {
    var u = getSelectedUser(); if (!u) return;
    STATE.currentQrText = subBaseUrl(u) + '?format=singbox';
    $('qr-caption').textContent = 'SING-BOX / HIDDIFY SUB';
    drawQrInto('main-qr', STATE.currentQrText);
  };
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
    $('s-frag-pkt').value = s.fragmentPackets || '1-1';
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
    $('s-infonodes').checked = s.showSubInfoNodes !== false;
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
      fragmentPackets: $('s-frag-pkt').value.trim() || '1-1',
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
      showSubInfoNodes: $('s-infonodes').checked
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

  var lastUserScanHealthy = [];

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
    var isOne = bare === '1.1.1.1' || bare === '1.0.0.1';
    return {
      rawLine: line,
      host: host,
      bareHost: bare,
      port: port,
      remark: remark || bare,
      isRawIp: (isIpv4 || isIpv6) && !isOne
    };
  }

  async function probeSingleCleanEntry(entry) {
    if (isSandboxPreview) {
      return { entry: entry, ms: 48 + Math.floor(Math.random() * 95), ok: true };
    }
    var timeoutMs = 3500;
    var targetBase = 'https://' + entry.host + (entry.port !== 443 ? (':' + entry.port) : '') + '/cdn-cgi/trace';

    async function singleAttempt() {
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var aborted = false;
      var tid = ctrl ? setTimeout(function () {
        aborted = true;
        try { ctrl.abort(); } catch (e) {}
      }, timeoutMs) : null;
      var t0 = performance.now();
      try {
        await fetch(targetBase + '?_nl=' + Date.now() + Math.random().toString(36).slice(2, 6), {
          mode: 'no-cors',
          cache: 'no-store',
          credentials: 'omit',
          signal: ctrl ? ctrl.signal : undefined
        });
        if (tid) clearTimeout(tid);
        return { resolved: true, aborted: false, ms: Math.round(performance.now() - t0) };
      } catch (err) {
        if (tid) clearTimeout(tid);
        var elapsed = Math.round(performance.now() - t0);
        var wasAbort = aborted || (err && err.name === 'AbortError');
        return { resolved: false, aborted: wasAbort, ms: elapsed };
      }
    }

    var first = await singleAttempt();
    if (first.resolved) {
      return { entry: entry, ms: Math.max(1, first.ms), ok: true };
    }
    if (entry.isRawIp && !first.aborted && first.ms >= 14 && first.ms < timeoutMs - 150) {
      var second = await singleAttempt();
      if (!second.aborted && second.ms >= 10 && second.ms < timeoutMs - 150) {
        return { entry: entry, ms: Math.round((first.ms + second.ms) / 2), ok: true };
      }
    }
    return { entry: entry, ms: 9999, ok: false };
  }

  async function probeBatch(entries, concurrency) {
    var out = new Array(entries.length);
    var cursor = 0;
    async function worker() {
      while (cursor < entries.length) {
        var idx = cursor++;
        out[idx] = await probeSingleCleanEntry(entries[idx]);
      }
    }
    var workers = [];
    for (var i = 0; i < Math.min(concurrency || 6, entries.length); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
    return out;
  }

  if ($('btn-scan-user-list')) {
    $('btn-scan-user-list').onclick = async function () {
      var rawLines = textToLines($('s-cleanips').value);
      var parsedList = rawLines.map(parseUserCleanLine).filter(Boolean);
      if (!parsedList.length) {
        showToast('ابتدا چند IP یا دامنه در کادر بالا وارد کنید', 'Enter at least one IP or domain above');
        return;
      }

      var box = $('scan-results');
      var sumEl = $('scan-summary');
      var pruneBtn = $('btn-prune-clean');
      box.hidden = false;
      if (pruneBtn) pruneBtn.hidden = true;
      if (sumEl) {
        sumEl.hidden = false;
        sumEl.textContent = tr(
          'در حال تست زندهٔ ' + parsedList.length + ' مورد روی اینترنت فعلی مرورگر شما…',
          'Testing ' + parsedList.length + ' listed endpoints from your browser…'
        );
      }
      box.innerHTML = '';

      var results = await probeBatch(parsedList, 6);
      results.sort(function (a, b) { return a.ms - b.ms; });

      lastUserScanHealthy = results.filter(function (r) { return r.ok; });
      if (sumEl) {
        sumEl.textContent = tr(
          'نتیجهٔ اسکن لیست شما: ' + lastUserScanHealthy.length + ' سالم از ' + results.length + ' مورد' +
            (lastUserScanHealthy.length ? (' · سریع‌ترین: ' + lastUserScanHealthy[0].entry.bareHost + ' (' + lastUserScanHealthy[0].ms + 'ms)') : ''),
          'Your list scan: ' + lastUserScanHealthy.length + ' / ' + results.length + ' reachable' +
            (lastUserScanHealthy.length ? (' · fastest: ' + lastUserScanHealthy[0].entry.bareHost + ' (' + lastUserScanHealthy[0].ms + 'ms)') : '')
        );
      }
      if (pruneBtn && lastUserScanHealthy.length > 0) {
        pruneBtn.hidden = false;
      }

      box.innerHTML = '';
      results.forEach(function (r) {
        var item = document.createElement('div');
        item.className = 'scan-item';
        var labelStr = r.entry.bareHost + (r.entry.port !== 443 ? (':' + r.entry.port) : '');
        item.innerHTML =
          '<span>' + esc(labelStr) + ' <small style="opacity:.7">(' + esc(r.entry.remark) + ')</small></span>' +
          (r.ok
            ? '<span class="badge ok">' + svgIcon('check', 'ic-sm') + ' ' + r.ms + ' ms</span>'
            : '<span class="badge bad">' + svgIcon('x', 'ic-sm') + ' TIMEOUT</span>');
        box.appendChild(item);
      });
    };
  }

  if ($('btn-prune-clean')) {
    $('btn-prune-clean').onclick = function () {
      if (!lastUserScanHealthy.length) return;
      $('s-cleanips').value = lastUserScanHealthy.map(function (r) { return r.entry.rawLine; }).join('\n');
      $('btn-prune-clean').hidden = true;
      showToast('فقط موارد سالم به ترتیب سرعت مرتب شدند؛ دکمهٔ ذخیره را بزنید', 'Kept & sorted healthy IPs — click Save');
    };
  }

  $('btn-scan-clean').onclick = async function () {
    try {
      var box = $('scan-results');
      var sumEl = $('scan-summary');
      if ($('btn-prune-clean')) $('btn-prune-clean').hidden = true;
      box.hidden = false;
      if (sumEl) {
        sumEl.hidden = false;
        sumEl.textContent = tr('در حال اسکن رنج‌های منتخب کلادفلر روی اینترنت شما…', 'Scanning Cloudflare preset ranges…');
      }
      box.innerHTML = '';

      var presetRaw = [
        'www.speedtest.net#Speedtest',
        'cp.cloudflare.com#CF-Captive',
        'radar.cloudflare.com#CF-Radar',
        'cdnjs.cloudflare.com#CDNJS',
        '1.1.1.1#CF-One',
        '104.16.132.229#CF-104-16',
        '104.18.2.14#CF-104-18',
        '172.67.73.163#CF-172-67',
        '162.159.135.42#CF-162-159',
        '172.64.80.1#CF-172-64'
      ];
      var entries = presetRaw.map(parseUserCleanLine).filter(Boolean);
      var results = await probeBatch(entries, 6);
      results.sort(function (a, b) { return a.ms - b.ms; });

      var okCount = results.filter(function (r) { return r.ok; }).length;
      if (sumEl) {
        sumEl.textContent = tr(
          okCount + ' مورد از رنج‌های پیشنهادی روی اینترنت شما باز است:',
          okCount + ' preset Cloudflare endpoints reachable on your ISP:'
        );
      }

      box.innerHTML = '';
      results.forEach(function (r) {
        var item = document.createElement('div');
        item.className = 'scan-item';
        var msText = r.ok ? (r.ms + ' ms') : 'TIMEOUT';
        item.innerHTML =
          '<span>' + esc(r.entry.bareHost) + ' <b style="opacity:.7">(' + esc(msText) + ')</b></span>' +
          (r.ok ? '<button class="btn ghost sm-btn" type="button">' + svgIcon('plus', 'ic-sm') + '<span>ADD</span></button>' : '<span class="badge bad">FAIL</span>');
        var addBtn = item.querySelector('button');
        if (addBtn) {
          addBtn.onclick = function () {
            var cur = textToLines($('s-cleanips').value);
            if (cur.indexOf(r.entry.rawLine) < 0) cur.push(r.entry.rawLine);
            $('s-cleanips').value = cur.join('\n');
            addBtn.innerHTML = svgIcon('check', 'ic-sm') + '<span>OK</span>';
          };
        }
        box.appendChild(item);
      });
    } catch (err) {
      showToast(err.message, err.message);
    }
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
      var r = await api('/api/test-proxyip', 'POST', { target: target });
      if (r.ok) showToast('اتصال زنجیره‌ای برقرار است (' + r.latencyMs + 'ms)', 'Chain OK (' + r.latencyMs + 'ms)');
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
      a.download = 'nightline-backup-' + new Date().toISOString().slice(0, 10) + '.json';
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

  /* -------- Hardcoded GitHub Updater (https://github.com/youdidking/NightLine) -------- */

  function syncGhUpdaterUI(ver) {
    var curV = ver || (STATE.ghInfo && STATE.ghInfo.currentVersion) || '2.5.1';
    if ($('gh-mini-ver')) $('gh-mini-ver').textContent = 'V' + curV;
    if ($('gh-cur-ver')) $('gh-cur-ver').textContent = 'V' + curV;
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
    ghChecking = true;
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
      showGhMessage(err.message, false);
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
          'در حال دریافت بستهٔ رسمی از github.com/youdidking/NightLine و استقرار روی ورکر کلادفلر (حفظ کامل KV و مشترکین)…',
          'Downloading official bundle from github.com/youdidking/NightLine & deploying to Cloudflare Worker…'
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
