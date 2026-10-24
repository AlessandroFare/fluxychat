/**
 * OAuth redirect target for per-user MCP connections
 * (/public/ops/mcp/oauth/callback).
 *
 * The `state` is the authority: a single-use, 10-minute token, stored only as a
 * hash, minted for one user and server by POST /ops/mcp-servers/:id/connect.
 * This route is public because the browser arrives from the provider; nothing
 * is returned except an HTML page (or JSON when asked), never token material.
 */
import { checkAndConsumeIpRateLimit } from "./ip-rate-limit.js";
import { completeMcpConnect } from "./ops-mcp-oauth.js";
import { escapeHtml, htmlPage } from "./tap-http-common.js";

function page({ status, title, message }) {
  return new Response(htmlPage(title, `<p>${escapeHtml(message)}</p>`), {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function messageFor(error) {
  if (error === "invalid_state") return "This connect link is invalid or was already used. Start again from Process tools.";
  if (error === "expired_state") return "This connect link expired. Start again from Process tools.";
  if (error === "server_not_found") return "The MCP server was removed.";
  if (error === "server_mode_changed") return "The server's connection mode changed while you were signing in. Start again.";
  if (error === "encryption_key_missing") return "The Worker cannot encrypt tokens: set WEBHOOK_SECRET_ENCRYPTION_KEY.";
  if (error === "token_exchange_failed") return "The provider refused the token exchange. Check the client credentials and scopes.";
  if (error === "id_jag_exchange_failed") return "The identity provider refused to issue an ID-JAG. Check the audience and the enterprise policy.";
  if (error === "id_jag_invalid") return "The identity provider returned an ID-JAG this server did not trust.";
  if (error === "idp_jwks_unavailable") return "The identity provider's signing keys could not be loaded. Check the JWKS URL.";
  if (error === "enterprise_config_incomplete") return "This enterprise server is missing part of its ID-JAG configuration. An admin must complete it in Ops settings.";
  if (String(error || "").startsWith("upstream_")) return "The provider returned an error instead of a code.";
  return "Could not complete the connection.";
}

export async function handleMcpOauthCallback(request, url, env, json, corsHeaders) {
  const wantsJson = String(request.headers.get("accept") || "").includes("application/json");
  const limited = await checkAndConsumeIpRateLimit(env, {
    request,
    scope: "mcp-oauth-callback",
    limit: 30,
    windowSeconds: 60,
  }).catch(() => {
    const allowFallback = env.RATE_LIMIT_FALLBACK_ALLOW === "true" || env.RATE_LIMIT_FALLBACK_ALLOW === "1";
    return { allowed: allowFallback, retryAfterSeconds: 5 };
  });
  if (limited && limited.allowed === false) {
    if (wantsJson) {
      return json(
        { ok: false, error: "rate_limited", message: "Too many connect attempts. Try again in a minute." },
        { status: 429, headers: corsHeaders },
      );
    }
    return page({ status: 429, title: "Too many attempts", message: "Too many connect attempts. Try again in a minute." });
  }

  const { getOpsStore } = await import("../routes/ops-http.js");
  const store = getOpsStore(env);
  const result = await completeMcpConnect(store, env, {
    state: url.searchParams.get("state"),
    code: url.searchParams.get("code"),
    error: url.searchParams.get("error"),
  }).catch(() => ({ ok: false, error: "connect_failed" }));

  if (wantsJson) return json(result, { status: result.ok ? 200 : 400, headers: corsHeaders });
  return result.ok
    ? page({
        status: 200,
        title: "Account connected",
        message: `Connected${result.serverName ? ` to ${result.serverName}` : ""}. You can close this tab and start the run.`,
      })
    : page({ status: 400, title: "Connection failed", message: messageFor(result.error) });
}
