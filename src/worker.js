/**
 * NIGHTLINE — Cloudflare Worker & Pages Entrypoint (Free-Tier 10ms CPU optimized).
 */

import {
  hashPassword,
  PBKDF2_DEFAULT_ITER,
  randomPassword,
  randomToken,
  randomUUID,
  safeDecodeURIComponent,
  safeJsonParse,
  signSession,
  verifyPassword,
  verifySession,
} from './crypto.js';
import {
  appendLog,
  checkLoginRateLimit,
  clearLoginFailures,
  enrichUserView,
  initializePanelState,
  loadRuntimeState,
  normalizeUser,
  PANEL_BRAND,
  PANEL_VERSION,
  recordLoginFailure,
  sanitizeSettings,
  saveRuntimeState,
} from './storage.js';
import { handlePrivateDoH, handleTunnelWS, probeOutboundEndpoint } from './protocols.js';
import {
  buildTgProxyLinks,
  generateTgSecret,
  handleTgSessionApi,
  handleTgWebSocket,
  maybeHandleTgBridgePage,
} from './tgproxy.js';
import {
  buildClashYaml,
  buildNodeDescriptors,
  buildSingboxConfig,
  buildXrayConfigs,
  computeQuickUserNodeMeta,
  renderDecoyGazette,
  serveSubscription,
} from './sub.js';
import { getInlineAssets, getPanelHtml } from './generated/ui.js';

const SESSION_COOKIE = 'nl_sess';
const SESSION_TTL_MS = 7 * 86_400_000;
const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;
const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#141311"/><rect x="4" y="4" width="56" height="56" fill="none" stroke="#f2ede3" stroke-width="2"/><text x="32" y="45" text-anchor="middle" font-family="monospace" font-weight="700" font-size="36" fill="#f2ede3">N</text></svg>';

function extractColo(request) {
  const direct = request.cf && request.cf.colo ? String(request.cf.colo).trim() : '';
  if (direct && direct.toUpperCase() !== 'EDGE') return direct.toUpperCase();
  const ray = request.headers.get('cf-ray') || '';
  const dash = ray.lastIndexOf('-');
  if (dash > 0 && ray.length - dash <= 5) {
    const code = ray.slice(dash + 1).trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) return code;
  }
  return 'CF-GLOBAL';
}

export default {
  async fetch(request, env = {}, ctx = {}) {
    try {
      const url = new URL(request.url);
      const path = url.pathname || '/';
      const upgradeHeader = (request.headers.get('upgrade') || '').toLowerCase();

      // 0) Fast zero-KV favicon response
      if (upgradeHeader !== 'websocket' && path === '/favicon.ico') {
        return new Response(FAVICON_SVG, {
          status: 200,
          headers: {
            'content-type': 'image/svg+xml; charset=utf-8',
            'cache-control': 'public, max-age=86400',
          },
        });
      }

      const runtime = await loadRuntimeState(env);

      // 1) WebSocket Upgrade: Official Telegram Web Proxy (`/api/v1/ws`) OR VLESS/Trojan Tunnel
      if (upgradeHeader === 'websocket') {
        const wsProto = request.headers.get('sec-websocket-protocol') || '';
        if (path === '/api/v1/ws' && wsProto.includes('tproxy-lane-v1.')) {
          return await handleTgWebSocket(request, url, runtime.settings);
        }
        return await handleTunnelWS(request, env, ctx, runtime);
      }

      // 1b) Official Telegram Web Proxy HTTP Bridge & Session Lease endpoints
      if (path === '/api/v1/session') {
        return await handleTgSessionApi(request, runtime.settings);
      }
      if (path === '/' && url.search.startsWith('?bridge=')) {
        const tgBridge = await maybeHandleTgBridgePage(request, url, runtime.settings);
        if (tgBridge) return tgBridge;
      }

      // 2) Health probe (`/health` & `/api/ping`)
      if (path === '/api/ping' || path === '/health') {
        return json(
          {
            ok: true,
            version: PANEL_VERSION,
            kvBound: runtime.kvBound,
            initialized: runtime.initialized,
            ts: Date.now(),
            colo: extractColo(request),
            country: request.cf?.country || '',
          },
          200,
          { 'access-control-allow-origin': '*' }
        );
      }

      // 3) Admin Panel REST API
      if (path.startsWith('/api/')) {
        return await handleApi(request, url, env, runtime);
      }

      // 4) Private DoH endpoint: /dns-query/:subToken
      if (path.startsWith('/dns-query/')) {
        const token = safeDecodeURIComponent(path.slice('/dns-query/'.length).split('/')[0], '').trim();
        const matched = findActiveTokenUser(runtime, token);
        if (!matched) {
          return new Response('Forbidden DoH token', { status: 403 });
        }
        return await handlePrivateDoH(request, runtime.settings.upstreamDoH);
      }

      // 5) Subscription endpoints: /sub/:token  OR /sub?uuid=...
      if (path === '/sub' || path.startsWith('/sub/')) {
        const rawTok = path.startsWith('/sub/')
          ? path.slice('/sub/'.length).split('/')[0]
          : (url.searchParams.get('token') || url.searchParams.get('uuid') || '');
        const token = safeDecodeURIComponent(rawTok, '').trim();
        const matched = findSubscriptionUser(runtime, token);
        if (!matched) {
          return json({ ok: false, error: 'لینک اشتراک معتبر نیست یا منقضی شده است.' }, 404);
        }
        return await serveSubscription(request, matched, runtime.settings, await getInlineAssets());
      }

      // 6) Explicit Admin Panel route (/panel)
      if (path === '/panel' || path === '/panel/') {
        return await servePanelShell(request, env);
      }

      // 7) Camouflage / Root mode handling on `/`
      if (path === '/' && runtime.initialized) {
        if (runtime.settings.rootMode === 'gazette') {
          return new Response(renderDecoyGazette(await getInlineAssets()), {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
        }
        if (runtime.settings.fallbackDomain) {
          if (runtime.settings.rootMode === 'fallback') {
            return await proxyFallbackDomain(request, runtime.settings.fallbackDomain, await getInlineAssets());
          }
        }
      }

      // 8) Fallback reverse-proxy for non-panel paths when fallbackDomain is configured
      if (
        runtime.initialized &&
        runtime.settings.rootMode === 'fallback' &&
        runtime.settings.fallbackDomain &&
        !path.startsWith('/panel')
      ) {
        return await proxyFallbackDomain(request, runtime.settings.fallbackDomain, await getInlineAssets());
      }

      // 9) Default: serve Admin Panel UI
      return await servePanelShell(request, env);
    } catch (err) {
      return json(
        {
          ok: false,
          error: 'خطای داخلی سرور رخ داد؛ درخواست با ایمنی مهار شد.',
          detail: err && err.message ? err.message : String(err),
        },
        500
      );
    }
  },
};

/* --------------------------------------------------------- REST API Router */

async function handleApi(request, url, env, runtime) {
  const path = url.pathname;
  const method = request.method.toUpperCase();
  const clientIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    'local';

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': url.origin,
        'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }

  // ---- GET /api/bootstrap ----
  if (path === '/api/bootstrap' && method === 'GET') {
    const authed = await isAuthenticated(request, runtime);
    const colo = extractColo(request);
    const cfInfo = {
      host: url.host,
      origin: url.origin,
      colo,
      country: request.cf?.country || '',
      asn: request.cf?.asn || '',
      asOrganization: request.cf?.asOrganization || '',
      clientIp,
      httpProtocol: request.cf?.httpProtocol || 'HTTP/2',
      tlsVersion: request.cf?.tlsVersion || 'TLSv1.3',
    };

    if (!runtime.kvBound) {
      return json({
        ok: true,
        version: PANEL_VERSION,
        state: runtime.initialized ? 'stateless' : 'needs_kv',
        mode: 'stateless',
        kvBound: false,
        hasEnvUuid: Boolean(runtime.envUuid),
        authenticated: false,
        host: url.host,
        edge: cfInfo.colo,
        cf: cfInfo,
        tgProxy:
          runtime.settings.enableTgProxy !== false
            ? buildTgProxyLinks(url.host, runtime.settings.tgProxySecret, runtime.settings.tgProxyDomain)
            : null,
        statelessUser: runtime.users[0]
          ? buildAdminUserSummary(runtime.users[0], runtime.settings, url.host)
          : null,
      });
    }

    if (!runtime.initialized) {
      return json({
        ok: true,
        version: PANEL_VERSION,
        state: 'needs_setup',
        mode: 'setup',
        kvBound: true,
        kvName: runtime.kvName,
        authenticated: false,
        host: url.host,
        edge: cfInfo.colo,
        cf: cfInfo,
      });
    }

    if (!authed) {
      return json({
        ok: true,
        version: PANEL_VERSION,
        state: 'locked',
        mode: 'login',
        kvBound: true,
        kvName: runtime.kvName,
        authenticated: false,
        host: url.host,
        edge: cfInfo.colo,
        cf: cfInfo,
      });
    }

    const fresh = await loadRuntimeState(env, true);
    return json(buildFullAdminPayload(fresh, url.host, cfInfo));
  }

  // ---- POST /api/setup ----
  if (path === '/api/setup' && method === 'POST') {
    if (!runtime.kvBound) {
      return json(
        {
          ok: false,
          error: 'ابتدا یک فضای KV با نام KV در تنظیمات ورکر (Settings → Bindings) متصل کنید.',
        },
        400
      );
    }
    if (runtime.initialized) {
      return json({ ok: false, error: 'پنل قبلاً راه‌اندازی شده است. لطفاً وارد شوید.' }, 403);
    }

    const body = await readJsonBody(request);
    if (body.__parseError) return json({ ok: false, error: body.__parseError }, 400);

    const password = String(body.password || '');
    if (password.length < 6) {
      return json({ ok: false, error: 'گذرواژه مدیریت باید دست‌کم ۶ نویسه باشد.' }, 400);
    }

    const created = await initializePanelState(env, {
      password,
      firstUserName: body.firstUserName || 'سردبیر (اصلی)',
      preferredUuid: body.preferredUuid || body.uuid || '',
    });

    const token = await signSession(
      { sub: 'admin', ver: created.auth.ver, exp: Date.now() + SESSION_TTL_MS },
      created.auth.secret
    );

    const cfInfo = {
      host: url.host,
      origin: url.origin,
      colo: extractColo(request),
      country: request.cf?.country || '',
      clientIp,
    };

    return json(buildFullAdminPayload(created, url.host, cfInfo), 200, {
      'set-cookie': formatSessionCookie(token, url.protocol === 'https:'),
    });
  }

  // ---- POST /api/login ----
  if (path === '/api/login' && method === 'POST') {
    if (!runtime.initialized || !runtime.auth) {
      return json({ ok: false, error: 'پنل هنوز راه‌اندازی نشده است.' }, 400);
    }

    const limit = checkLoginRateLimit(clientIp);
    if (!limit.allowed) {
      return json(
        { ok: false, error: `تلاش‌های ناموفق بیش از حد مجاز. ${limit.retrySec} ثانیه صبر کنید.` },
        429
      );
    }

    const body = await readJsonBody(request);
    if (body.__parseError) return json({ ok: false, error: body.__parseError }, 400);

    const rawPw = String(body.password || '');
    const valid = await verifyPassword(rawPw, runtime.auth);
    if (!valid) {
      recordLoginFailure(clientIp);
      return json({ ok: false, error: 'گذرواژه اشتباه است.' }, 401);
    }

    clearLoginFailures(clientIp);
    let fresh = await loadRuntimeState(env, true);

    // Auto-migrate legacy high-iteration PBKDF2 records down to Free-Tier-safe 10,000 iterations
    if ((fresh.auth?.iter || 0) > PBKDF2_DEFAULT_ITER) {
      const upgraded = await hashPassword(rawPw, null, PBKDF2_DEFAULT_ITER);
      fresh.auth = { ...fresh.auth, ...upgraded };
      fresh = await saveRuntimeState(env, fresh);
    }

    const token = await signSession(
      { sub: 'admin', ver: fresh.auth.ver, exp: Date.now() + SESSION_TTL_MS },
      fresh.auth.secret
    );

    const cfInfo = {
      host: url.host,
      origin: url.origin,
      colo: extractColo(request),
      country: request.cf?.country || '',
      clientIp,
    };

    return json(buildFullAdminPayload(fresh, url.host, cfInfo), 200, {
      'set-cookie': formatSessionCookie(token, url.protocol === 'https:'),
    });
  }

  // ---- POST /api/logout ----
  if (path === '/api/logout' && method === 'POST') {
    return json({ ok: true }, 200, {
      'set-cookie': `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    });
  }

  // =========================================================================
  // Authenticated admin endpoints below
  // =========================================================================
  if (!(await isAuthenticated(request, runtime))) {
    return json({ ok: false, error: 'نشست مدیریتی منقضی شده یا وارد نشده‌اید.' }, 401);
  }

  const state = await loadRuntimeState(env, true);

  // ---- POST /api/killswitch ----
  if (path === '/api/killswitch' && method === 'POST') {
    const body = await readJsonBody(request);
    const nextKill =
      !body.__parseError && typeof body.killSwitch === 'boolean'
        ? body.killSwitch
        : !state.settings.killSwitch;
    state.settings = sanitizeSettings(
      { ...state.settings, killSwitch: nextKill },
      state.settings
    );
    appendLog(
      state,
      'killswitch',
      state.settings.killSwitch ? 'کلید قطع اضطراری فعال شد' : 'کلید قطع اضطراری غیرفعال شد'
    );
    const saved = await saveRuntimeState(env, state);
    return json(buildFullAdminPayload(saved, url.host));
  }

  // ---- PUT /api/settings ----
  if (path === '/api/settings' && (method === 'PUT' || method === 'POST')) {
    const patch = await readJsonBody(request);
    if (patch.__parseError) return json({ ok: false, error: patch.__parseError }, 400);

    state.settings = sanitizeSettings(patch, state.settings);
    appendLog(state, 'settings', 'تنظیمات هسته و مسیریابی به‌روزرسانی شد');
    const saved = await saveRuntimeState(env, state);
    return json(buildFullAdminPayload(saved, url.host));
  }

  // ---- POST /api/password ----
  if (path === '/api/password' && method === 'POST') {
    const body = await readJsonBody(request);
    if (body.__parseError) return json({ ok: false, error: body.__parseError }, 400);

    const currentOk = await verifyPassword(String(body.currentPassword || ''), state.auth);
    if (!currentOk) {
      return json({ ok: false, error: 'گذرواژه فعلی نادرست است.' }, 400);
    }
    const nextPw = String(body.newPassword || '');
    if (nextPw.length < 6) {
      return json({ ok: false, error: 'گذرواژه جدید باید دست‌کم ۶ نویسه باشد.' }, 400);
    }
    const pwRec = await hashPassword(nextPw, null, PBKDF2_DEFAULT_ITER);
    state.auth = {
      ...state.auth,
      ...pwRec,
      ver: (state.auth.ver || 1) + 1,
      updatedAt: Date.now(),
    };
    appendLog(state, 'security', 'گذرواژه مدیریت تغییر یافت');
    const saved = await saveRuntimeState(env, state);
    const token = await signSession(
      { sub: 'admin', ver: saved.auth.ver, exp: Date.now() + SESSION_TTL_MS },
      saved.auth.secret
    );
    return json({ ok: true }, 200, {
      'set-cookie': formatSessionCookie(token, url.protocol === 'https:'),
    });
  }

  // ---- POST /api/users ----
  if (path === '/api/users' && method === 'POST') {
    if (state.users.length >= 200) {
      return json({ ok: false, error: 'حداکثر ۲۰۰ مشترک در یک ورکر پشتیبانی می‌شود.' }, 400);
    }
    const body = await readJsonBody(request);
    if (body.__parseError) return json({ ok: false, error: body.__parseError }, 400);

    const newUser = normalizeUser({
      name: body.name || `مشترک ${state.users.length + 1}`,
      note: body.note || '',
      uuid: body.uuid || randomUUID(),
      trojanPassword: body.trojanPassword || randomPassword(14),
      subToken: randomToken(16),
      trafficLimitGB: Number(body.trafficLimitGB || 0),
      expiryDays: Number(body.expiryDays || 0),
      startOnFirstUse: Boolean(body.startOnFirstUse),
      enabled: body.enabled !== false,
    });
    state.users.push(newUser);
    appendLog(state, 'user:add', `مشترک جدید ساخته شد: ${newUser.name}`);
    const saved = await saveRuntimeState(env, state);
    return json({ ...buildFullAdminPayload(saved, url.host), createdId: newUser.id });
  }

  // ---- GET /api/users/:id/nodes ----
  const userNodesMatch = path.match(/^\/api\/users\/([^/]+)\/nodes$/);
  if (userNodesMatch && method === 'GET') {
    const uid = safeDecodeURIComponent(userNodesMatch[1], '');
    const target = state.users.find((u) => u.id === uid);
    if (!target) return json({ ok: false, error: 'مشترک یافت نشد.' }, 404);
    const uView = enrichUserView(target);
    return json({
      ok: true,
      user: buildAdminUserSummary(target, state.settings, url.host),
      nodes: buildNodeDescriptors(uView, state.settings, url.host),
      xrayPreview: buildXrayConfigs(uView, state.settings, url.host)[0] || null,
      singboxPreview: buildSingboxConfig(uView, state.settings, url.host),
      clashPreview: buildClashYaml(uView, state.settings, url.host),
    });
  }

  // ---- PUT / DELETE / POST actions on /api/users/:id ----
  const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch) {
    const uid = safeDecodeURIComponent(userMatch[1], '');
    const idx = state.users.findIndex((u) => u.id === uid);
    if (idx === -1) return json({ ok: false, error: 'مشترک یافت نشد.' }, 404);

    if (method === 'DELETE') {
      if (state.users.length <= 1) {
        return json({ ok: false, error: 'حداقل یک حسابِ مشترک باید در پنل باقی بماند.' }, 400);
      }
      const removed = state.users.splice(idx, 1)[0];
      appendLog(state, 'user:del', `مشترک حذف شد: ${removed.name}`);
      const saved = await saveRuntimeState(env, state);
      return json(buildFullAdminPayload(saved, url.host));
    }

    if (method === 'PUT' || method === 'POST') {
      const body = await readJsonBody(request);
      if (body.__parseError) return json({ ok: false, error: body.__parseError }, 400);

      const cur = state.users[idx];
      const doReset = body.action === 'reset_traffic' || Boolean(body.resetTraffic);
      const doRotate = body.action === 'rotate_keys' || Boolean(body.rotateKeys);

      if (doReset) {
        cur.usedUpBytes = 0;
        cur.usedDownBytes = 0;
        state.users[idx] = normalizeUser(cur, true);
        appendLog(state, 'user:reset', `ریست مصرف ترافیک: ${cur.name}`);
      } else if (doRotate) {
        cur.uuid = randomUUID();
        cur.trojanPassword = randomPassword(14);
        cur.subToken = randomToken(16);
        state.users[idx] = normalizeUser(cur);
        appendLog(state, 'user:rotate', `چرخش کلیدهای امنیتی: ${cur.name}`);
      } else {
        const expiryDays = body.expiryDays !== undefined ? Math.max(0, Number(body.expiryDays) || 0) : cur.expiryDays;
        const startOnFirstUse = body.startOnFirstUse !== undefined ? Boolean(body.startOnFirstUse) : cur.startOnFirstUse;
        let expiresAt = cur.expiresAt;

        if (body.expiryDays !== undefined || body.startOnFirstUse !== undefined) {
          if (expiryDays === 0) expiresAt = 0;
          else if (startOnFirstUse) expiresAt = 0;
          else expiresAt = Date.now() + expiryDays * 86_400_000;
        }

        const pwUnchanged = !body.trojanPassword || body.trojanPassword === cur.trojanPassword;
        state.users[idx] = normalizeUser(
          {
            ...cur,
            name: body.name !== undefined ? body.name : cur.name,
            note: body.note !== undefined ? body.note : cur.note,
            enabled: body.enabled !== undefined ? Boolean(body.enabled) : cur.enabled,
            uuid: body.uuid || cur.uuid,
            trojanPassword: body.trojanPassword || cur.trojanPassword,
            trafficLimitGB: body.trafficLimitGB !== undefined ? Number(body.trafficLimitGB) : cur.trafficLimitGB,
            expiryDays,
            startOnFirstUse,
            expiresAt,
            clearExpiry: expiryDays === 0,
          },
          pwUnchanged
        );
        appendLog(state, 'user:edit', `ویرایش مشترک: ${state.users[idx].name}`);
      }

      const saved = await saveRuntimeState(env, state);
      return json(buildFullAdminPayload(saved, url.host));
    }
  }

  // ---- POST /api/tgproxy/rotate ----
  if (path === '/api/tgproxy/rotate' && method === 'POST') {
    state.settings = sanitizeSettings(
      { ...state.settings, tgProxySecret: generateTgSecret() },
      state.settings
    );
    appendLog(state, 'tgproxy', 'کلید مخفی پروکسی تلگرام بازتولید شد');
    const saved = await saveRuntimeState(env, state);
    return json(buildFullAdminPayload(saved, url.host));
  }

  // ---- POST /api/tools/probe-proxy & /api/test-proxyip ----
  if ((path === '/api/tools/probe-proxy' || path === '/api/test-proxyip') && method === 'POST') {
    const body = await readJsonBody(request);
    if (body.__parseError) return json({ ok: false, error: body.__parseError }, 400);
    const result = await probeOutboundEndpoint(body.target || '');
    return json(result);
  }

  // ---- GET /api/backup ----
  if (path === '/api/backup' && method === 'GET') {
    return new Response(
      JSON.stringify(
        {
          ok: true,
          version: 2,
          nightlineBackupVersion: 2,
          exportedAt: new Date().toISOString(),
          settings: state.settings,
          users: state.users,
        },
        null,
        2
      ),
      {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename="nightline-backup-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      }
    );
  }

  // ---- POST /api/restore ----
  if (path === '/api/restore' && method === 'POST') {
    const body = await readJsonBody(request);
    if (body.__parseError) return json({ ok: false, error: body.__parseError }, 400);
    if (!body || (!body.settings && !Array.isArray(body.users))) {
      return json({ ok: false, error: 'فایل پشتیبان معتبر نیست.' }, 400);
    }
    if (body.settings && typeof body.settings === 'object') {
      state.settings = sanitizeSettings(body.settings, state.settings);
    }
    if (Array.isArray(body.users) && body.users.length > 0) {
      state.users = body.users.slice(0, 200).map((u) => normalizeUser(u));
    }
    appendLog(state, 'restore', 'نسخه پشتیبان با موفقیت بازیابی شد');
    const saved = await saveRuntimeState(env, state);
    return json(buildFullAdminPayload(saved, url.host));
  }

  return json({ ok: false, error: 'مسیر API یافت نشد.' }, 404);
}

/* --------------------------------------------------------------- Utilities */

function buildAdminUserSummary(user, settings, host) {
  const v = enrichUserView(user);
  const subBase = `https://${host}/sub/${encodeURIComponent(v.subToken)}`;
  const quickMeta = computeQuickUserNodeMeta(v, settings, host);
  return {
    id: v.id,
    name: v.name,
    note: v.note,
    enabled: v.enabled,
    status: v.status,
    uuid: v.uuid,
    trojanPassword: v.trojanPassword,
    subToken: v.subToken,
    trafficLimitGB: v.trafficLimitGB,
    usedUpBytes: v.usedUpBytes,
    usedDownBytes: v.usedDownBytes,
    usedBytes: v.usedBytes,
    limitBytes: v.limitBytes,
    connections: v.connections,
    expiryDays: v.expiryDays,
    expiresAt: v.expiresAt,
    effectiveExpiresAt: v.effectiveExpiresAt,
    remainingDays: v.remainingDays,
    startOnFirstUse: v.startOnFirstUse,
    firstConnectedAt: v.firstConnectedAt,
    lastSeenAt: v.lastSeenAt,
    nodeCount: quickMeta.nodeCount,
    urls: {
      pressPass: subBase,
      normalSub: `${subBase}?format=b64`,
      rawSub: `${subBase}?format=raw`,
      xrayFragmentSub: `${subBase}?format=xray`,
      singboxSub: `${subBase}?format=singbox`,
      clashSub: `${subBase}?format=clash`,
      privateDoH: `https://${host}/dns-query/${encodeURIComponent(v.subToken)}`,
      primaryVless: quickMeta.primaryVless,
      primaryTrojan: quickMeta.primaryTrojan,
    },
  };
}

function buildFullAdminPayload(state, host, cf = null) {
  const users = (state.users || []).map((u) => buildAdminUserSummary(u, state.settings, host));
  const totals = users.reduce(
    (acc, u) => {
      acc.totalUsedBytes += u.usedBytes;
      acc.totalConnections += u.connections;
      if (u.status === 'active') acc.activeUsers += 1;
      return acc;
    },
    { totalUsedBytes: 0, totalConnections: 0, activeUsers: 0 }
  );

  const firstRaw = state.users && state.users[0] ? enrichUserView(state.users[0]) : null;
  const initialNodes = firstRaw ? buildNodeDescriptors(firstRaw, state.settings, host) : [];
  const tgProxy =
    state.settings.enableTgProxy !== false && state.settings.tgProxySecret
      ? buildTgProxyLinks(host, state.settings.tgProxySecret, state.settings.tgProxyDomain)
      : null;

  return {
    ok: true,
    version: PANEL_VERSION,
    state: 'ready',
    mode: 'admin',
    host,
    edge: cf?.colo || 'CF-GLOBAL',
    kvBound: state.kvBound,
    kvName: state.kvName,
    authenticated: true,
    brand: PANEL_BRAND,
    settings: state.settings,
    tgProxy,
    users,
    initialNodes,
    totals,
    logs: state.logs || [],
    ...(cf ? { cf } : {}),
  };
}

function findSubscriptionUser(runtime, token) {
  if (!token || !Array.isArray(runtime?.users)) return null;
  const low = token.toLowerCase();
  return (
    runtime.users.find(
      (u) => u && (u.subToken === token || String(u.uuid || '').toLowerCase() === low)
    ) || null
  );
}

function findActiveTokenUser(runtime, token) {
  const u = findSubscriptionUser(runtime, token);
  if (!u) return null;
  return enrichUserView(u).status === 'active' ? u : null;
}

async function isAuthenticated(request, runtime) {
  if (!runtime || !runtime.initialized || !runtime.auth || !runtime.auth.secret) return false;
  const cookie = readCookie(request.headers.get('cookie') || '', SESSION_COOKIE);
  if (!cookie) return false;
  const session = await verifySession(cookie, runtime.auth.secret, runtime.auth.ver || 1);
  return Boolean(session && session.sub === 'admin');
}

function readCookie(cookieHeader, name) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return '';
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return safeDecodeURIComponent(part.slice(idx + 1).trim(), '');
  }
  return '';
}

function formatSessionCookie(token, isHttps) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}`;
}

async function readJsonBody(request) {
  try {
    const lenHeader = Number(request.headers.get('content-length') || 0);
    if (lenHeader > MAX_JSON_BODY_BYTES) {
      return { __parseError: 'حجم داده ارسالی بیش از حد مجاز است.' };
    }
    const text = await request.text();
    if (!text || !text.trim()) return {};
    if (text.length > MAX_JSON_BODY_BYTES) {
      return { __parseError: 'حجم داده ارسالی بیش از حد مجاز است.' };
    }
    const parsed = safeJsonParse(text, undefined);
    if (parsed === undefined || typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { __parseError: 'ساختار JSON ارسالی معتبر نیست.' };
    }
    return parsed;
  } catch {
    return { __parseError: 'خطا در خواندن بدنه درخواست.' };
  }
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

async function proxyFallbackDomain(request, fallbackDomain, inlineAssets) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => {
    try { ctrl.abort(); } catch {}
  }, 8000);
  try {
    const srcUrl = new URL(request.url);
    const targetUrl = new URL(`https://${fallbackDomain}${srcUrl.pathname}${srcUrl.search}`);
    const headers = new Headers(request.headers);
    headers.set('host', targetUrl.host);
    headers.delete('cookie');
    const resp = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method.toUpperCase()) ? undefined : request.body,
      redirect: 'manual',
      signal: ctrl.signal,
    });
    return new Response(resp.body, {
      status: resp.status,
      headers: new Headers(resp.headers),
    });
  } catch {
    return new Response(renderDecoyGazette(inlineAssets), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  } finally {
    clearTimeout(tid);
  }
}

async function servePanelShell(request, env) {
  if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
    try {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = '/index.html';
      const assetResp = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
      if (assetResp && assetResp.ok) return assetResp;
    } catch {}
  }
  const html = await getPanelHtml();
  if (typeof html === 'string' && html.length > 0) {
    return new Response(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-cache',
      },
    });
  }
  return new Response('NIGHTLINE UI bundle missing — run `npm run build`.', { status: 500 });
}
