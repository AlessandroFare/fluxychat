import { createD1ApprovalStore } from "./hitl-approval-d1.js";
import { hitlTapSecret, verifyHitlTapToken } from "./hitl-tap-token.js";
import { checkAndConsumeIpRateLimit } from "./ip-rate-limit.js";
import {
  hitlSlackActionFromPayload,
  hitlSlackSigningSecret,
  isHitlApprovalUuid,
  verifySlackRequestSignature,
} from "./hitl-slack-sign.js";
import { getFluxyUserIdForSlackUser } from "./hitl-slack-user-map.js";

function slackAck(text, status = 200) {
  return new Response(JSON.stringify({ replace_original: true, text }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function applyHitlSlackPayload(env, payload) {
  const { action, value, slackUserId } = hitlSlackActionFromPayload(payload);
  const store = createD1ApprovalStore(env);

  if (isHitlApprovalUuid(value) && action) {
    const entry = await store.get(value);
    if (!entry) return slackAck("This request was already decided or could not be found.");
    const mapped = await getFluxyUserIdForSlackUser(env, entry.projectId, slackUserId);
    if (!mapped) {
      return slackAck("This Slack account is not mapped to a FluxyChat user. Use the email link, or ask an admin to save your Slack user id.");
    }
    try {
      await store.decide(entry.id, mapped, action, "slack_mapped");
    } catch (err) {
      const reason = err instanceof Error ? err.message : "decide_failed";
      if (reason === "not_current_approver") {
        return slackAck("This Slack account is not the current approver.");
      }
      if (String(reason).includes("already") || String(reason).includes("not found")) {
        return slackAck("This request was already decided or could not be found.");
      }
      return slackAck("Could not record that decision.");
    }
    const verb = action === "approve" ? "approved" : "denied";
    return slackAck(`Tool call ${verb}.`);
  }

  const token = value.length > 0 && value.length <= 4096 ? value : "";
  const tap = await verifyHitlTapToken(hitlTapSecret(env), token);
  if (!tap) {
    return slackAck("That HITL button is invalid or expired.");
  }

  try {
    await store.decide(tap.approvalId, tap.userId, tap.action, "slack_interactive");
  } catch (err) {
    const reason = err instanceof Error ? err.message : "decide_failed";
    if (reason === "not_current_approver") {
      return slackAck("This button is not for the current approver.");
    }
    if (String(reason).includes("already") || String(reason).includes("not found")) {
      return slackAck("This request was already decided or could not be found.");
    }
    return slackAck("Could not record that decision.");
  }

  const verb = tap.action === "approve" ? "approved" : "denied";
  return slackAck(`Tool call ${verb}.`);
}

export async function handlePublicHitlSlack(request, env) {
  const limited = await checkAndConsumeIpRateLimit(env, {
    request,
    scope: "hitl-slack",
    limit: 60,
    windowSeconds: 60,
  }).catch(() => ({ allowed: true }));
  if (limited && limited.allowed === false) {
    return slackAck("Too many Slack HITL posts. Try again in a minute.", 429);
  }

  const signingSecret = hitlSlackSigningSecret(env);
  if (!signingSecret) {
    return slackAck("HITL_SLACK_SIGNING_SECRET is not set on this Worker.", 503);
  }

  const rawBody = await request.text();
  const okSig = await verifySlackRequestSignature({
    signingSecret,
    timestamp: request.headers.get("X-Slack-Request-Timestamp"),
    rawBody,
    signatureHeader: request.headers.get("X-Slack-Signature"),
  });
  if (!okSig) {
    return new Response("invalid_signature", { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const params = new URLSearchParams(rawBody);
  let payload;
  try {
    payload = JSON.parse(params.get("payload") || "");
  } catch {
    payload = null;
  }
  if (!payload || payload.type !== "block_actions") {
    return slackAck("Ignored Slack payload.");
  }

  return applyHitlSlackPayload(env, payload);
}
