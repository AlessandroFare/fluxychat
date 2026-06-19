/**
 * P18-A + P18-G: Identity & Access HTTP routes
 * SSO/SAML, SCIM provisioning, 2FA TOTP
 */

import { depsEnv } from "../lib/deps-env.js";
import { verifyJwtAndGetContext } from "../lib/jwt-auth.js";
import { parseSamlAssertion, validateSamlTiming, validateSamlAudience, createSsoSession, getSamlConfig, upsertSamlConfig, generateSpMetadata } from '../lib/sso-saml.js';
import { createScimUser, getScimUser, listScimUsers, updateScimUser, deleteScimUser, createScimGroup, listScimGroups, createScimToken, listScimTokens, deleteScimToken, verifyScimToken } from '../lib/scim.js';
import { enrollTotp, verifyAndEnableTotp, verifyAdminTotp, isTotpEnabled, getTotpStatus, disableTotp } from '../lib/totp-2fa.js';
import { buildAllowedOriginsList } from "../lib/custom-domains.js";

function resolveCorsHeaders(request, env, h) {
  // Audit S-9: identity routes (SAML/SCIM/TOTP) must NEVER inherit a wildcard
  // CORS from the worker entry. Always compute a project-scoped allowlist.
  void h;
  const allowedOrigins = buildAllowedOriginsList(env, null);
  // Identity endpoints are server-to-server or admin-console; never use `*`
  // even if the project allows it, because the response body can include
  // tokens, SAML configs, and 2FA state.
  const safeOrigins = allowedOrigins.filter((o) => o !== "*");
  const requestOrigin = request.headers.get("Origin") || "";
  const corsOrigin =
    requestOrigin && safeOrigins.includes(requestOrigin) ? requestOrigin : null;
  return {
    ...(corsOrigin ? { "Access-Control-Allow-Origin": corsOrigin } : {}),
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Fluxy-Api-Key,X-Project-Id",
    "Vary": "Origin",
  };
}

function json(data, status = 200, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function hasAnyRole(roles, allowed) {
  if (!roles) return false;
  return roles.some((r) => allowed.includes(r));
}

export async function dispatchIdentityRoutes(request, url, h) {
  const env = depsEnv(h);
  const corsHeaders = resolveCorsHeaders(request, env, h);
  const respond = (data, status = 200) => json(data, status, corsHeaders);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const path = url.pathname;

  // ─── SAML Configuration (admin only) ───

  if (path === "/saml/config" && request.method === "GET") {
    const auth = await verifyAdmin(request, env);
    if (auth.error) return respond({ error: auth.error }, auth.status);

    const config = await getSamlConfig(env, auth.projectId);
    if (!config) return respond({ configured: false });
    return respond({
      configured: true,
      idp_entity_id: config.idp_entity_id,
      idp_sso_url: config.idp_sso_url,
      sp_entity_id: config.sp_entity_id,
      sp_acs_url: config.sp_acs_url,
      name_id_format: config.name_id_format,
      attribute_mapping: JSON.parse(config.attribute_mapping || '{}'),
      enabled: config.enabled === 1,
    });
  }

  if (path === "/saml/config" && request.method === "POST") {
    const auth = await verifyAdmin(request, env);
    if (auth.error) return respond({ error: auth.error }, auth.status);

    const body = await request.json();
    if (!body.idp_entity_id || !body.idp_sso_url || !body.idp_certificate || !body.sp_acs_url) {
      return respond({ error: 'Missing required SAML fields: idp_entity_id, idp_sso_url, idp_certificate, sp_acs_url' }, 400);
    }

    const result = await upsertSamlConfig(env, auth.projectId, body);
    return respond({ ok: true, id: result.id });
  }

  if (path === "/saml/metadata" && request.method === "GET") {
    const auth = await verifyAdmin(request, env);
    if (auth.error) return respond({ error: auth.error }, auth.status);

    const config = await getSamlConfig(env, auth.projectId);
    if (!config) return respond({ error: 'SAML not configured' }, 404);

    const xml = generateSpMetadata(config.sp_entity_id, config.sp_acs_url);
    return new Response(xml, { status: 200, headers: { "Content-Type": "application/xml", ...corsHeaders } });
  }

  if (path === "/saml/acs" && request.method === "POST") {
    const form = await request.formData();
    const samlResponse = form.get('SAMLResponse');
    if (!samlResponse) return respond({ error: 'Missing SAMLResponse' }, 400);

    const relayState = form.get('RelayState');
    let projectId;
    try {
      const relay = JSON.parse(relayState || '{}');
      projectId = relay.projectId;
    } catch {
      return respond({ error: 'Invalid RelayState' }, 400);
    }
    if (!projectId) return respond({ error: 'Missing projectId in RelayState' }, 400);

    const config = await getSamlConfig(env, projectId);
    if (!config) return respond({ error: 'SAML not configured' }, 400);

    // Audit CRITICAL #1: parseSamlAssertion is async — it was previously called
    // WITHOUT await, so `assertion` was a Promise and `assertion.isValid` was
    // undefined. (`getSamlConfig` also returns snake_case columns, so we map to
    // the camelCase shape parseSamlAssertion expects, otherwise it short-circuits
    // to `saml_not_configured` regardless of the signature.)
    const samlConfig = {
      idpEntityId: config.idp_entity_id,
      idpCertificate: config.idp_certificate,
      wantAssertionsSigned: config.want_assertions_signed === 1,
      spEntityId: config.sp_entity_id,
      spAcsUrl: config.sp_acs_url,
    };
    const assertion = await parseSamlAssertion(samlResponse, samlConfig);
    if (!assertion.isValid) {
      // Audit S-21: surface the specific reason so operators can diagnose
      // misconfiguration, but never accept the assertion anyway.
      return respond(
        { error: 'Invalid SAML assertion', reason: assertion.reason || 'invalid' },
        401,
      );
    }

    const timing = validateSamlTiming(assertion);
    if (!timing.valid) return respond({ error: timing.reason }, 401);

    // Audit #16: validate AudienceRestriction == SP entityID and Recipient ==
    // configured ACS URL so a validly-signed assertion minted for another SP
    // cannot be replayed here (audience confusion / token reuse).
    const audience = validateSamlAudience(assertion, samlConfig);
    if (!audience.valid) return respond({ error: 'Invalid SAML audience', reason: audience.reason }, 401);

    const mapping = JSON.parse(config.attribute_mapping || '{}');
    const email = assertion.attributes[mapping.email || 'email'] || assertion.nameId;
    const name = assertion.attributes[mapping.name || 'displayName'] || email;

    const totpEnabled = await isTotpEnabled(env, projectId, email);
    if (totpEnabled) {
      const ssoSession = await createSsoSession(env, projectId, config.id, assertion, null);
      return respond({ requires2fa: true, ssoSessionId: ssoSession.id, email });
    }

    // Mint JWT directly
    const secretRow = await env.DB.prepare(
      `SELECT jwt_secret FROM project_secrets WHERE project_id = ?`
    ).bind(projectId).first();
    if (!secretRow) return respond({ error: 'Project not configured' }, 500);

    const now = Math.floor(Date.now() / 1000);
    const jwt = await signJwtLocal(secretRow.jwt_secret, {
      sub: email, tid: projectId, roles: ['member'], iat: now, exp: now + 8 * 3600,
    });

    const ssoSession = await createSsoSession(env, projectId, config.id, assertion, jwt);
    return respond({ ok: true, token: jwt, userId: email, projectId, ssoSessionId: ssoSession.id });
  }

  if (path === "/saml/acs/verify-2fa" && request.method === "POST") {
    const body = await request.json();
    if (!body.ssoSessionId || !body.code) return respond({ error: 'Missing ssoSessionId or code' }, 400);

    const session = await env.DB.prepare(
      `SELECT * FROM sso_sessions WHERE id = ? AND expires_at > datetime('now')`
    ).bind(body.ssoSessionId).first();
    if (!session) return respond({ error: 'Invalid or expired SSO session' }, 401);

    const totpResult = await verifyAdminTotp(env, session.project_id, session.name_id, body.code);
    if (!totpResult.verified) return respond({ error: 'Invalid 2FA code' }, 401);

    const secretRow = await env.DB.prepare(
      `SELECT jwt_secret FROM project_secrets WHERE project_id = ?`
    ).bind(session.project_id).first();
    if (!secretRow) return respond({ error: 'Project not configured' }, 500);

    const now = Math.floor(Date.now() / 1000);
    const jwt = await signJwtLocal(secretRow.jwt_secret, {
      sub: session.name_id, tid: session.project_id, roles: ['member'], iat: now, exp: now + 8 * 3600,
    });

    await env.DB.prepare(`UPDATE sso_sessions SET jwt_token = ? WHERE id = ?`).bind(jwt, body.ssoSessionId).run();
    return respond({ ok: true, token: jwt, userId: session.name_id, projectId: session.project_id });
  }

  // ─── SCIM Provisioning ───

  if (path === "/scim/v2/Users" && request.method === "GET") {
    const projectId = url.searchParams.get('projectId');
    if (!projectId) return respond({ error: 'projectId required' }, 400);
    const tokenResult = await verifyScimBearer(request, env, projectId);
    if (!tokenResult) return respond({ error: 'Unauthorized' }, 401);

    const startIndex = parseInt(url.searchParams.get('startIndex') || '1');
    const count = parseInt(url.searchParams.get('count') || '25');
    const result = await listScimUsers(env, projectId, startIndex, count);
    return respond(result);
  }

  if (path === "/scim/v2/Users" && request.method === "POST") {
    const projectId = url.searchParams.get('projectId');
    if (!projectId) return respond({ error: 'projectId required' }, 400);
    const tokenResult = await verifyScimBearer(request, env, projectId);
    if (!tokenResult) return respond({ error: 'Unauthorized' }, 401);

    const body = await request.json();
    const user = await createScimUser(env, projectId, body);
    return respond(user, 201);
  }

  const scimUserMatch = path.match(/^\/scim\/v2\/Users\/(.+)$/);
  if (scimUserMatch && request.method === "GET") {
    const projectId = url.searchParams.get('projectId');
    if (!projectId) return respond({ error: 'projectId required' }, 400);
    const tokenResult = await verifyScimBearer(request, env, projectId);
    if (!tokenResult) return respond({ error: 'Unauthorized' }, 401);

    const user = await getScimUser(env, projectId, scimUserMatch[1]);
    if (!user) return respond({ error: 'User not found' }, 404);
    return respond(user);
  }

  if (scimUserMatch && request.method === "PUT") {
    const projectId = url.searchParams.get('projectId');
    if (!projectId) return respond({ error: 'projectId required' }, 400);
    const tokenResult = await verifyScimBearer(request, env, projectId);
    if (!tokenResult) return respond({ error: 'Unauthorized' }, 401);

    const body = await request.json();
    const user = await updateScimUser(env, projectId, scimUserMatch[1], body);
    if (!user) return respond({ error: 'User not found' }, 404);
    return respond(user);
  }

  if (scimUserMatch && request.method === "DELETE") {
    const projectId = url.searchParams.get('projectId');
    if (!projectId) return respond({ error: 'projectId required' }, 400);
    const tokenResult = await verifyScimBearer(request, env, projectId);
    if (!tokenResult) return respond({ error: 'Unauthorized' }, 401);

    const deleted = await deleteScimUser(env, projectId, scimUserMatch[1]);
    if (!deleted) return respond({ error: 'User not found' }, 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (path === "/scim/v2/Groups" && request.method === "GET") {
    const projectId = url.searchParams.get('projectId');
    if (!projectId) return respond({ error: 'projectId required' }, 400);
    const tokenResult = await verifyScimBearer(request, env, projectId);
    if (!tokenResult) return respond({ error: 'Unauthorized' }, 401);

    const startIndex = parseInt(url.searchParams.get('startIndex') || '1');
    const count = parseInt(url.searchParams.get('count') || '25');
    const result = await listScimGroups(env, projectId, startIndex, count);
    return respond(result);
  }

  if (path === "/scim/v2/Groups" && request.method === "POST") {
    const projectId = url.searchParams.get('projectId');
    if (!projectId) return respond({ error: 'projectId required' }, 400);
    const tokenResult = await verifyScimBearer(request, env, projectId);
    if (!tokenResult) return respond({ error: 'Unauthorized' }, 401);

    const body = await request.json();
    const group = await createScimGroup(env, projectId, body);
    return respond(group, 201);
  }

  // ─── SCIM Token Management (admin) ───

  if (path === "/admin/scim/tokens" && request.method === "POST") {
    const auth = await verifyAdmin(request, env);
    if (auth.error) return respond({ error: auth.error }, auth.status);

    const body = await request.json();
    const result = await createScimToken(env, auth.projectId, body.description, body.scopes);
    return respond(result, 201);
  }

  if (path === "/admin/scim/tokens" && request.method === "GET") {
    const auth = await verifyAdmin(request, env);
    if (auth.error) return respond({ error: auth.error }, auth.status);

    const tokens = await listScimTokens(env, auth.projectId);
    return respond({ tokens });
  }

  const scimTokenMatch = path.match(/^\/admin\/scim\/tokens\/(.+)$/);
  if (scimTokenMatch && request.method === "DELETE") {
    const auth = await verifyAdmin(request, env);
    if (auth.error) return respond({ error: auth.error }, auth.status);

    const deleted = await deleteScimToken(env, auth.projectId, scimTokenMatch[1]);
    if (!deleted) return respond({ error: 'Token not found' }, 404);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ─── 2FA TOTP (admin) ───

  if (path === "/admin/2fa/enroll" && request.method === "POST") {
    const auth = await verifyAdmin(request, env);
    if (auth.error) return respond({ error: auth.error }, auth.status);

    const result = await enrollTotp(env, auth.projectId, auth.userId);
    const uri = `otpauth://totp/FluxyChat:${encodeURIComponent(auth.userId)}?secret=${result.secret}&issuer=FluxyChat&algorithm=SHA1&digits=6&period=30`;
    return respond({ secret: result.secret, uri, format: 'totp' });
  }

  if (path === "/admin/2fa/verify" && request.method === "POST") {
    const auth = await verifyAdmin(request, env);
    if (auth.error) return respond({ error: auth.error }, auth.status);

    const body = await request.json();
    if (!body.code) return respond({ error: 'Missing code' }, 400);

    const result = await verifyAndEnableTotp(env, auth.projectId, auth.userId, body.code);
    if (!result.success) return respond({ error: result.reason }, 400);
    return respond({ ok: true, backupCodes: result.backupCodes });
  }

  if (path === "/admin/2fa/status" && request.method === "GET") {
    const auth = await verifyAdmin(request, env);
    if (auth.error) return respond({ error: auth.error }, auth.status);

    const status = await getTotpStatus(env, auth.projectId, auth.userId);
    return respond(status);
  }

  if (path === "/admin/2fa/disable" && request.method === "POST") {
    const auth = await verifyAdmin(request, env);
    if (auth.error) return respond({ error: auth.error }, auth.status);

    await disableTotp(env, auth.projectId, auth.userId);
    return respond({ ok: true });
  }

  if (path === "/auth/admin/2fa-verify" && request.method === "POST") {
    const body = await request.json();
    if (!body.projectId || !body.userId || !body.code) {
      return respond({ error: 'Missing projectId, userId, or code' }, 400);
    }
    const result = await verifyAdminTotp(env, body.projectId, body.userId, body.code);
    if (!result.verified) return respond({ error: 'Invalid 2FA code' }, 401);
    return respond({ ok: true, method: result.method });
  }

  return null; // Not handled by this dispatcher
}

// --- Auth helpers ---

async function verifyAdmin(request, env) {
  // Audit CRITICAL #2: previously this decoded the JWT payload with `atob`
  // and NEVER verified the HMAC signature ("no verification needed for admin
  // check"), so any attacker could forge {tid, roles:["owner"]} and gain full
  // admin on SAML config / SCIM / 2FA for any tenant. We now verify the
  // signature via the canonical project-secret path before trusting roles.
  let ctx;
  try {
    ctx = await verifyJwtAndGetContext(request, env);
  } catch (e) {
    if (e instanceof Response) {
      return { error: e.status === 403 ? "forbidden" : "unauthorized", status: e.status };
    }
    throw e;
  }
  if (!ctx) return { error: "unauthorized", status: 401 };
  if (!hasAnyRole(ctx.roles, ['owner', 'admin'])) return { error: "forbidden", status: 403 };
  return { projectId: ctx.projectId, userId: ctx.userId, roles: ctx.roles };
}

async function verifyScimBearer(request, env, projectId) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return verifyScimToken(env, projectId, authHeader);
}

// Local JWT sign (mirrors worker.js signJwtHs256)
async function signJwtLocal(secret, payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const enc = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const data = `${enc(header)}.${enc(payload)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

