function hexFromBuffer(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualString(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hmacHex(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return hexFromBuffer(mac);
}

/**
 * Slack request signing (v0). Timestamp must be within 5 minutes.
 * https://docs.slack.dev/authentication/verifying-requests-from-slack
 */
export async function verifySlackRequestSignature({
  signingSecret,
  timestamp,
  rawBody,
  signatureHeader,
}) {
  const secret = String(signingSecret || "");
  const ts = String(timestamp || "");
  const sig = String(signatureHeader || "");
  const body = String(rawBody || "");
  if (!secret || !ts || !sig || !body) return false;
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return false;
  const expected = `v0=${await hmacHex(secret, `v0:${ts}:${body}`)}`;
  return timingSafeEqualString(expected, sig);
}

export function hitlSlackSigningSecret(env) {
  return String(env.HITL_SLACK_SIGNING_SECRET || "").trim();
}

const HITL_APPROVAL_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isHitlApprovalUuid(value) {
  return typeof value === "string" && HITL_APPROVAL_UUID_RE.test(value);
}

export function hitlSlackActionFromPayload(payload) {
  const actions = Array.isArray(payload?.actions) ? payload.actions : [];
  const first = actions[0];
  const actionId = typeof first?.action_id === "string" ? first.action_id : "";
  const value = typeof first?.value === "string" ? first.value : "";
  let action = null;
  if (actionId === "fluxy_hitl_approve") action = "approve";
  else if (actionId === "fluxy_hitl_deny") action = "deny";
  const slackUserId =
    typeof payload?.user?.id === "string" ? payload.user.id : "";
  return { action, value, slackUserId };
}

/** Interactive buttons when signing secret is set; otherwise link buttons (browser GET). */
export function hitlSlackActionElements({
  interactive,
  mappedApprovalId,
  approveTok,
  denyTok,
  approveUrl,
  denyUrl,
}) {
  if (interactive && mappedApprovalId) {
    return [
      {
        type: "button",
        text: { type: "plain_text", text: "Approve" },
        action_id: "fluxy_hitl_approve",
        value: mappedApprovalId,
        style: "primary",
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Deny" },
        action_id: "fluxy_hitl_deny",
        value: mappedApprovalId,
      },
    ];
  }
  if (interactive && approveTok && denyTok) {
    return [
      {
        type: "button",
        text: { type: "plain_text", text: "Approve" },
        action_id: "fluxy_hitl_approve",
        value: approveTok,
        style: "primary",
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Deny" },
        action_id: "fluxy_hitl_deny",
        value: denyTok,
      },
    ];
  }
  return [
    approveUrl
      ? {
          type: "button",
          text: { type: "plain_text", text: "Approve" },
          url: approveUrl,
          style: "primary",
        }
      : null,
    denyUrl
      ? {
          type: "button",
          text: { type: "plain_text", text: "Deny" },
          url: denyUrl,
        }
      : null,
  ].filter(Boolean);
}
