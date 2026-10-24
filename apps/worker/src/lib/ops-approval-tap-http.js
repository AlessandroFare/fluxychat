/**
 * One-tap decisions for ops run approvals (/public/ops/approvals/tap).
 *
 * The email link is a signed, single-use token bound to the approval, the
 * frozen payload hash, one recipient, and the decision (approve or deny). Links
 * are only issued to the run room's admins, so possession substitutes for the
 * admin JWT the console path requires. GET never records anything: it renders a
 * confirmation form (email scanners and Slack unfurls stop there), and the POST
 * posts back the same token.
 */
import { consumeHitlTapNonce, hitlTapSecret, verifyHitlTapToken } from "./hitl-tap-token.js";
import { checkAndConsumeIpRateLimit } from "./ip-rate-limit.js";
import { escapeHtml, readTapToken, tapResponse } from "./tap-http-common.js";
import { decideRunApproval } from "./ops-engine.js";
import { executeOpsTool } from "./ops-sources.js";
import { normalizeOpsPolicy } from "./ops-policy.js";

function decideErrorMessage(error) {
  if (error === "duplicate_decision") return "You already decided this request.";
  if (error === "already_decided") return "This request was already decided.";
  if (error === "run_not_waiting") return "This run is no longer waiting for approval.";
  if (error === "not_found") return "This request was already decided or could not be found.";
  return "Could not record that decision.";
}

export async function handlePublicOpsApprovalTap(request, url, env, json, corsHeaders) {
  const limited = await checkAndConsumeIpRateLimit(env, {
    request,
    scope: "ops-approval-tap",
    limit: 30,
    windowSeconds: 60,
  }).catch(() => {
    const allowFallback =
      env.RATE_LIMIT_FALLBACK_ALLOW === "true" || env.RATE_LIMIT_FALLBACK_ALLOW === "1";
    return { allowed: allowFallback, retryAfterSeconds: 5 };
  });
  const wantsJson = String(request.headers.get("accept") || "").includes("application/json");
  if (limited && limited.allowed === false) {
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

  const payload = await verifyHitlTapToken(hitlTapSecret(env), token);
  if (!payload || payload.kind !== "ops" || !payload.projectId) {
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
<form method="post" action="/public/ops/approvals/tap">
  <input type="hidden" name="token" value="${escapeHtml(token)}" />
  <button type="submit">${verb} this run approval</button>
</form>
<p>The button posts a one-time token bound to this approver and the frozen payload.</p>`;
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

  const { getOpsStore } = await import("../routes/ops-http.js");
  const store = getOpsStore(env);
  const approval = await store.getApproval(payload.projectId, payload.approvalId).catch(() => null);
  if (!approval || approval.status !== "pending") {
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
  // Compare before deciding: a mismatched hash must not void the approval.
  if (payload.payloadHash && payload.payloadHash !== approval.payloadHash) {
    return tapResponse({
      wantsJson,
      json,
      corsHeaders,
      status: 409,
      ok: false,
      error: "payload_changed",
      message: "The frozen payload changed after this link was issued. Open the console to review.",
    });
  }
  const run = await store.getRun(payload.projectId, approval.runId).catch(() => null);
  if (!run || approval.stepId === "publish") {
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

  const policy = normalizeOpsPolicy(await store.getPolicy(payload.projectId));
  let result;
  try {
    result = await decideRunApproval(store, {
      env,
      projectId: payload.projectId,
      approvalId: payload.approvalId,
      actor: payload.userId,
      decision: payload.action,
      payloadHash: payload.payloadHash,
      executeTool: (name, input, extra) =>
        executeOpsTool(store, policy, env, name, input, { ...extra, projectId: payload.projectId }),
    });
  } catch {
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
  if (!result.ok) {
    return tapResponse({
      wantsJson,
      json,
      corsHeaders,
      status: result.error === "duplicate_decision" ? 409 : 400,
      ok: false,
      error: result.error,
      message: decideErrorMessage(result.error),
    });
  }

  const recorded = result.approval;
  const message =
    recorded.status === "approved"
      ? "Approved. The run resumes. You can close this tab."
      : recorded.status === "denied"
        ? "Denied. The run stops on this step. You can close this tab."
        : `Decision recorded (${recorded.decisions.length} of ${recorded.required || 1}). More approvals are still needed.`;
  return tapResponse({ wantsJson, json, corsHeaders, status: 200, ok: true, message });
}
