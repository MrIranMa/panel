/* NIGHTLINE v2 — Complete Client Application (Vanilla ES6, zero external deps) */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var html = document.documentElement;

  var LS = {
    get: function (k) { try { return localStorage.getItem('nl.' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('nl.' + k, v); } catch (e) {} }
  };

  var lang = LS.get('lang') === 'en' ? 'en' : 'fa';
  var theme = LS.get('theme') === 'dark' ? 'dark' : 'light';

  var STATE = {
    mode: 'loading',
    isDemo: false,
    host: location.host || 'nightline.workers.dev',
    edge: '—',
    settings: null,
    users: [],
    logs: [],
    selectedUserId: '',
    currentNodes: [],
    currentQrText: '',
    currentQrCaption: 'SUBSCRIPTION'
  };

  /* ------------------------------------------------- Helpers & Typography */

  function tr(fa, en) {
    return lang === 'fa' ? fa : en;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
      showToast((labelFa || 'لینک') + ' رونوشت شد ✦', (labelEn || 'Copied') + ' ✦');
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

  function applyAppearance() {
    html.setAttribute('data-lang', lang);
    html.setAttribute('lang', lang === 'fa' ? 'fa' : 'en');
    html.setAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr');
    html.setAttribute('data-theme', theme);
    $('lang').textContent = lang === 'fa' ? 'EN' : 'FA';
    document.querySelectorAll('.t-pick').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-th') === theme);
    });
    if (STATE.currentQrText) drawQrInto('main-qr', STATE.currentQrText);
    renderStatelessTicket();
    if (STATE.mode === 'admin') {
      renderAdminHeader();
      renderActiveUserPass();
      renderUsersLedger();
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

  // Official Free & Non-Commercial Popup Notice
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

  function randHex(bytesLen) {
    var arr = new Uint8Array(bytesLen);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(arr);
    else for (var i = 0; i < bytesLen; i++) arr[i] = Math.floor(Math.random() * 256);
    var out = '';
    for (var j = 0; j < arr.length; j++) out += arr[j].toString(16).padStart(2, '0');
    return out;
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
      subToken: 'm9p4v7x2n8q3w6z1', trafficLimitGB: 20, usedUpBytes: 0, usedDownBytes: 0,
      usedBytes: 0, limitBytes: 21474836480, connections: 0, expiryDays: 15,
      effectiveExpiresAt: 0, remainingDays: 15, startOnFirstUse: true, status: 'active'
    };
    demoStore = {
      version: '2.3.0',
      mode: 'admin', kvBound: true, kvName: 'PREVIEW_KV', initialized: true, authenticated: true,
      edge: 'AMS', host: 'nightline.example.workers.dev',
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
        { ts: Date.now() - 120000, event: 'setup', detail: 'پیش‌نمایش تعاملی پنل آماده است (V2.3.0)' },
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
    STATE.edge = data.edge || (data.cf && data.cf.colo) || 'CF-GLOBAL';

    $('top-edge').textContent = 'COLO · ' + STATE.edge;
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
      STATE.settings = data.settings;
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

      if (data.initialNodes && STATE.users[0] && STATE.selectedUserId === STATE.users[0].id) {
        STATE.currentNodes = data.initialNodes;
        renderActiveUserPass();
      } else {
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
      showToast('تحریریه افتتاح شد ✦', 'Panel initialized ✦');
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
      showToast('خوش آمدی ✦', 'Signed in ✦');
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

  // Stateless quick ticket
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
    $('st-kv').textContent = STATE.isDemo ? 'DEMO' : 'CONNECTED';
    var activeCount = STATE.users.filter(function (u) { return u.status === 'active'; }).length;
    $('st-users').textContent = activeCount + ' / ' + STATE.users.length;
    var totalB = STATE.users.reduce(function (acc, u) { return acc + (u.usedBytes || 0); }, 0);
    $('st-traffic').textContent = formatBytes(totalB);

    var killBtn = $('btn-kill');
    var killed = Boolean(s.killSwitch);
    killBtn.classList.toggle('active', killed);
    $('kill-fa').textContent = killed ? '⚠ تونل متوقف است (بازگشایی)' : 'کلید قطع اضطراری: خاموش';
    $('kill-en').textContent = killed ? '⚠ TUNNEL PAUSED (RESUME)' : 'KILL SWITCH: OFF';
  }

  $('btn-kill').addEventListener('click', async function () {
    try {
      var res = await api('/api/killswitch', 'POST', {});
      ingestBootstrap(res);
      showToast(
        res.settings.killSwitch ? 'تونل موقتاً متوقف شد' : 'تونل دوباره باز شد ✦',
        res.settings.killSwitch ? 'Tunnel paused' : 'Tunnel resumed ✦'
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
    ['sub', 'users', 'net', 'route', 'sec'].forEach(function (t) {
      $('pane-' + t).hidden = t !== tabName;
    });
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

    var pct = u.limitBytes > 0 ? Math.min(100, Math.round(((u.usedBytes || 0) / u.limitBytes) * 100)) : 6;
    $('u-meter').style.width = pct + '%';

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
          '<button class="btn ghost sm-btn" type="button">QR</button>' +
          '<button class="btn primary sm-btn" type="button">' + esc(tr('کپی', 'COPY')) + '</button>' +
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
        showToast('مشترک ویرایش شد ✦', 'Subscriber updated ✦');
      } else {
        res = await api('/api/users', 'POST', payload);
        if (res.createdId) STATE.selectedUserId = res.createdId;
        showToast('مشترک جدید ساخته شد ✦', 'Subscriber created ✦');
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
      var pct = u.limitBytes > 0 ? Math.min(100, Math.round(((u.usedBytes || 0) / u.limitBytes) * 100)) : 4;

      card.innerHTML =
        '<div class="user-head">' +
          '<div class="user-name">' + esc(u.name) + (u.note ? ' <span class="mono sm" style="opacity:.65">(' + esc(u.note) + ')</span>' : '') + '</div>' +
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
          '<button class="btn primary sm-btn u-act-sub" type="button">' + esc(tr('لینک و QR', 'LINKS & QR')) + '</button>' +
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
          showToast('مصرف مشترک صفر شد ✦', 'Bandwidth reset ✦');
        } catch (err) {
          showToast(err.message, err.message);
        }
      };
      card.querySelector('.u-act-rot').onclick = async function () {
        try {
          var r = await api('/api/users/' + encodeURIComponent(u.id), 'PUT', { rotateKeys: true });
          ingestBootstrap(r);
          showToast('شناسه، رمز Trojan و توکن تعویض شد ✦', 'Keys rotated ✦');
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

  /* ------------------------------------ Tabs 3, 4, 5: Settings & Scanners */

  function linesToText(arr) {
    return Array.isArray(arr) ? arr.join('\n') : '';
  }

  function textToLines(str) {
    return String(str || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function populateSettingsForms() {
    var s = STATE.settings || {};

    // Tab 3: Net & Fragment
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

    // Tab 4: Routing & DoH
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

    // Tab 5: Stealth
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
      showToast('تنظیمات در KV ذخیره شد ✦', 'Settings saved to KV ✦');
    } catch (err) {
      showToast(err.message, err.message);
    }
  }

  $('save-net').onclick = saveAllSettings;
  $('save-route').onclick = saveAllSettings;
  $('save-sec').onclick = saveAllSettings;

  // Telegram Web Proxy interactive controls
  if ($('btn-gen-tgsecret')) {
    $('btn-gen-tgsecret').onclick = function () {
      $('s-tgsecret').value = randHex(16);
      syncTgLinksUI();
      showToast('سکرت جدید ساخته شد؛ دکمهٔ ذخیره را بزن ✦', 'New secret generated — click Save ✦');
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

  // Fragment presets
  document.querySelectorAll('.frag-preset').forEach(function (btn) {
    btn.onclick = function () {
      $('s-frag-on').checked = true;
      $('s-frag-pkt').value = btn.getAttribute('data-p');
      $('s-frag-len').value = btn.getAttribute('data-l');
      $('s-frag-int').value = btn.getAttribute('data-i');
      showToast('پیش‌تنظیم Fragment اعمال شد؛ دکمهٔ ذخیره را بزن', 'Preset loaded — click Save');
    };
  });

  // Add Clean IP presets
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
    showToast('دامنه‌ها و IPهای تمیز اضافه شد ✦', 'Clean IP presets added ✦');
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
    // For raw Cloudflare Anycast IPs (no IP SAN in cert), TCP SYN + TLS ServerHello arrives
    // quickly before the browser aborts on SNI/SAN mismatch, whereas filtered/dead IPs hit AbortController timeout.
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

  // 1) Scan User's Own Listed IPs & Domains in `#s-cleanips`
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
            ? '<span class="badge ok">✓ ' + r.ms + ' ms</span>'
            : '<span class="badge bad">✕ TIMEOUT</span>');
        box.appendChild(item);
      });
    };
  }

  if ($('btn-prune-clean')) {
    $('btn-prune-clean').onclick = function () {
      if (!lastUserScanHealthy.length) return;
      $('s-cleanips').value = lastUserScanHealthy.map(function (r) { return r.entry.rawLine; }).join('\n');
      $('btn-prune-clean').hidden = true;
      showToast('فقط موارد سالم به ترتیب سرعت مرتب شدند؛ دکمهٔ ذخیره را بزنید ✦', 'Kept & sorted healthy IPs — click Save ✦');
    };
  }

  // 2) Scan Curated Cloudflare Anycast Preset Ranges
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
          (r.ok ? '<button class="btn ghost sm-btn" type="button">+ ADD</button>' : '<span class="badge bad">FAIL</span>');
        var addBtn = item.querySelector('button');
        if (addBtn) {
          addBtn.onclick = function () {
            var cur = textToLines($('s-cleanips').value);
            if (cur.indexOf(r.entry.rawLine) < 0) cur.push(r.entry.rawLine);
            $('s-cleanips').value = cur.join('\n');
            addBtn.textContent = '✓';
          };
        }
        box.appendChild(item);
      });
    } catch (err) {
      showToast(err.message, err.message);
    }
  };

  // Edge ProxyIP & Chain Proxy Tester
  $('btn-test-proxyip').onclick = async function () {
    var first = textToLines($('s-proxyips').value)[0] || '';
    if (!first) { showToast('ابتدا یک ProxyIP وارد کن', 'Enter a ProxyIP first'); return; }
    $('proxyip-res').textContent = 'TESTING…';
    try {
      var r = await api('/api/test-proxyip', 'POST', { target: first });
      $('proxyip-res').textContent = r.ok ? ('✓ OK · ' + r.latencyMs + ' ms') : ('✕ ' + r.error);
    } catch (e) {
      $('proxyip-res').textContent = '✕ ' + e.message;
    }
  };

  $('btn-test-chain').onclick = async function () {
    var target = $('s-chain').value.trim();
    if (!target) { showToast('آدرس پروکسی زنجیره‌ای خالی است', 'Enter chain proxy URL'); return; }
    try {
      var r = await api('/api/test-proxyip', 'POST', { target: target });
      if (r.ok) showToast('اتصال زنجیره‌ای برقرار است (' + r.latencyMs + 'ms) ✦', 'Chain OK (' + r.latencyMs + 'ms) ✦');
      else showToast('خطا: ' + r.error, 'Failed: ' + r.error);
    } catch (e) {
      showToast(e.message, e.message);
    }
  };

  // Password Change
  $('f-pass').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    try {
      await api('/api/password', 'POST', {
        currentPassword: $('pw-cur').value,
        newPassword: $('pw-new').value
      });
      $('pw-cur').value = '';
      $('pw-new').value = '';
      showToast('رمز عبور با موفقیت تغییر یافت ✦', 'Password updated ✦');
    } catch (err) {
      showToast(err.message, err.message);
    }
  });

  // Backup Export & Import
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
      showToast('فایل پشتیبان دانلود شد ✦', 'Backup downloaded ✦');
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
        showToast('پشتیبان با موفقیت بازیابی شد ✦', 'Backup restored ✦');
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

  /* --------------------------------------------------------------- Boot */

  $('year').textContent = String(new Date().getFullYear());
  applyAppearance();

  api('/api/bootstrap', 'GET')
    .then(ingestBootstrap)
    .catch(function () {
      $('diag-mode').textContent = 'OFFLINE';
      $('v-stateless').hidden = false;
      renderStatelessTicket();
    });
})();
