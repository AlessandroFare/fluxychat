import { createD1ApprovalStore } from "./hitl-approval-d1.js";
import { canonicalPayloadHash } from "./canonical-payload-hash.js";
import { consumeHitlTapNonce, hitlTapSecret, verifyHitlTapToken } from "./hitl-tap-token.js";
import { checkAndConsumeIpRateLimit } from "./ip-rate-limit.js";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlPage(title, bodyInner) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    ${bodyInner}
  </body>
</html>`;
}

function tapResponse({ wantsJson, json, corsHeaders, status, ok, error, message, htmlInner }) {
  if (wantsJson) {
    return json({ ok, error: error || undefined, message }, { status, headers: corsHeaders });
  }
  return new Response(htmlPage(ok ? "Approval" : "Approval failed", htmlInner || `<p>${escapeHtml(message)}</p>`), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

async function readTapToken(request, url) {
  const fromQuery = url.searchParams.get("token") || "";
  if (request.method === "GET") return fromQuery;
  const ctype = String(request.headers.get("content-type") || "");
  if (ctype.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return String(body?.token || fromQuery);
  }
  if (ctype.includes("application/x-www-form-urlencoded") || ctype.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    return String(form?.get("token") || fromQuery);
  }
  const text = await request.text().catch(() => "");
  if (text.includes("=")) {
    const params = new URLSearchParams(text);
    return params.get("token") || fromQuery;
  }
  return fromQuery;
}

export async function handlePublicHitlTap(request, url, env, json, corsHeaders) {
  const limited = await checkAndConsumeIpRateLimit(env, {
    request,
    scope: "hitl-tap",
    limit: 30,
    windowSeconds: 60,
  }).catch(() => ({ allowed: true }));
  if (limited && limited.allowed === false) {
    const wantsJson = String(request.headers.get("accept") || "").includes("application/json");
    return tapResponse({
      wantsJson,
      json,
      corsHeaders,
      status: 429,
      ok: false,
      error: "rate_limited",
      message: "Too many approval taps. Try again in a minute.",
    });
  }

  const wantsJson = String(request.headers.get("accept") || "").includes("application/json");
  const token = await readTapToken(request, url);
  if (token.length > 4096) {
    return tapResponse({
      wantsJson,
      json,
      corsHeaders,
      status: 400,
      ok: false,
      error: "invalid_token",
      message: "That approval link is not valid.",
    });
  }

  const secret = hitlTapSecret(env);
  const payload = await verifyHitlTapToken(secret, token);
  if (!payload) {
    return tapResponse({
      wantsJson,
      json,
      corsHeaders,
      status: 400,
      ok: false,
      error: "invalid_token",
      message: "That approval link is invalid or expired.",
    });
  }

  if (request.method === "GET") {
    const verb = payload.action === "approve" ? "Approve" : "Deny";
    const inner = `<p>This page does not record a decision. Email previews and Slack unfurls stop here.</p>
<form method="post" action="/public/hitl/tap">
  <input type="hidden" name="token" value="${escapeHtml(token)}" />
  <button type="submit">${escapeHtml(verb)} this tool call</button>
</form>
<p>The button posts a one-time token bound to this approver and the original tool payload.</p>`;
    return tapResponse({
      wantsJson,
      json,
      corsHeaders,
      status: 200,
      ok: true,
      message: "Confirm this decision with POST. GET does not approve.",
      htmlInner: inner,
    });
  }

  if (request.method !== "POST") {
    return tapResponse({
      wantsJson,
      json,
      corsHeaders,
      status: 405,
      ok: false,
      error: "method_not_allowed",
      message: "Use GET to review, POST to decide.",
    });
  }

  const consumed = await consumeHitlTapNonce(env, payload.jti);
  if (!consumed.ok) {
    return tapResponse({
      wantsJson,
      json,
      corsHeaders,
      status: consumed.error === "token_already_used" ? 409 : 503,
      ok: false,
      error: consumed.error,
      message:
        consumed.error === "token_already_used"
          ? "This confirmation link was already used."
          : "Could not consume that approval token.",
    });
  }

  const store = createD1ApprovalStore(env);
  const existing = await store.get(payload.approvalId).catch(() => null);
  if (!existing) {
    return tapResponse({
      wantsJson,
      json,
      corsHeaders,
      status: 409,
      ok: false,
      error: "already_decided",
      message: "This request was already decided or could not be found.",
    });
  }
  const currentHash = await canonicalPayloadHash({
    toolName: existing.toolName,
    toolInput: existing.toolInput,
  });
  if (payload.payloadHash && payload.payloadHash !== currentHash) {
    return tapResponse({
      wantsJson,
      json,
      corsHeaders,
      status: 409,
      ok: false,
      error: "payload_changed",
      message: "The tool payload changed after this link was issued. Open the console to review.",
    });
  }

  try {
    await store.decide(payload.approvalId, payload.userId, payload.action, "one_tap");
  } catch (err) {
    const reason = err instanceof Error ? err.message : "decide_failed";
    if (reason === "not_current_approver") {
      return tapResponse({
        wantsJson,
        json,
        corsHeaders,
        status: 403,
        ok: false,
        error: reason,
        message: "This link is not for the current approver.",
      });
    }
    if (String(reason).includes("already") || String(reason).includes("not found")) {
      return tapResponse({
        wantsJson,
        json,
        corsHeaders,
        status: 409,
        ok: false,
        error: "already_decided",
        message: "This request was already decided or could not be found.",
      });
    }
    return tapResponse({
      wantsJson,
      json,
      corsHeaders,
      status: 400,
      ok: false,
      error: "decide_failed",
      message: "Could not record that decision.",
    });
  }

  const verb = payload.action === "approve" ? "approved" : "denied";
  return tapResponse({
    wantsJson,
    json,
    corsHeaders,
    status: 200,
    ok: true,
    message: `Tool call ${verb}. You can close this tab.`,
  });
}
