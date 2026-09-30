import { canonicalPayloadHash } from "./canonical-payload-hash.js";
import { sendDigestEmail } from "./digest-email.js";
import { getDigestPreferences } from "./daily-digest.js";
import { signHitlTapToken, hitlTapSecret } from "./hitl-tap-token.js";
import { hitlSlackActionElements, hitlSlackSigningSecret } from "./hitl-slack-sign.js";
import { getSlackUserIdForFluxyUser } from "./hitl-slack-user-map.js";

function appOrigin(env) {
  return String(env.PUBLIC_APP_URL || env.WORKER_PUBLIC_URL || "").replace(/\/+$/, "");
}

export function isOperatorSlackWebhookUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === "https:" && parsed.hostname === "hooks.slack.com";
  } catch {
    return false;
  }
}

export async function notifyHitlOffRoom(env, {
  projectId,
  roomId,
  approvalId,
  approverId,
  toolName,
  toolInput,
  expiresAt,
}) {
  const origin = appOrigin(env);
  const secret = hitlTapSecret(env);
  const expCap = Date.now() + 15 * 60_000;
  const exp = Math.min(expiresAt ? Date.parse(expiresAt) || expCap : expCap, expCap);
  const payloadHash = await canonicalPayloadHash({ toolName, toolInput: toolInput || {} });
  const approveTok = secret
    ? await signHitlTapToken(secret, {
        approvalId,
        action: "approve",
        userId: approverId,
        exp,
        payloadHash,
      })
    : null;
  const denyTok = secret
    ? await signHitlTapToken(secret, {
        approvalId,
        action: "deny",
        userId: approverId,
        exp,
        payloadHash,
      })
    : null;
  const tapBase = origin ? `${origin}/public/hitl/tap` : "";
  const approveUrl = approveTok && tapBase ? `${tapBase}?token=${encodeURIComponent(approveTok)}` : null;
  const denyUrl = denyTok && tapBase ? `${tapBase}?token=${encodeURIComponent(denyTok)}` : null;
  const summary = `Tool ${toolName || "unknown"} in room ${roomId}. ${JSON.stringify(toolInput || {}).slice(0, 400)}`;

  let skipEmail = false;
  let email = null;
  try {
    const prefs = await getDigestPreferences(env, projectId, approverId);
    if (prefs.emailEnabled === false) skipEmail = true;
    if (!skipEmail && prefs.emailEnabled && prefs.email) email = prefs.email;
  } catch {
    /* ignore */
  }
  if (!skipEmail && !email) {
    const user = await env.DB.prepare(`SELECT email FROM users WHERE id = ?`).bind(approverId).first().catch(() => null);
    email = user?.email || null;
  }

  if (email && (approveUrl || denyUrl)) {
    const text = [
      summary,
      `Expires: ${expiresAt || "soon"}`,
      approveUrl ? `Approve: ${approveUrl}` : "",
      denyUrl ? `Deny: ${denyUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    await sendDigestEmail(env, {
      to: email,
      subject: `Approve agent tool: ${toolName || "tool"}`,
      textBody: text,
    }).catch(() => {});
  }

  const slack = String(env.HITL_SLACK_WEBHOOK_URL || "").trim();
  if (isOperatorSlackWebhookUrl(slack) && (approveUrl || denyUrl || hitlSlackSigningSecret(env))) {
    const mappedSlack = await getSlackUserIdForFluxyUser(env, projectId, approverId);
    const interactive = Boolean(hitlSlackSigningSecret(env));
    const mappedApprovalId = interactive && mappedSlack ? approvalId : null;
    const elements = hitlSlackActionElements({
      interactive,
      mappedApprovalId,
      approveTok: mappedApprovalId ? null : approveTok,
      denyTok: mappedApprovalId ? null : denyTok,
      approveUrl,
      denyUrl,
    });
    if (elements.length > 0) {
      await fetch(slack, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "manual",
      body: JSON.stringify({
        text: `FluxyChat HITL: ${summary}`,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: `*HITL*\n${summary}` } },
          {
            type: "actions",
            elements,
          },
        ],
      }),
    }).catch(() => {});
    }
  }

  return { approveUrl, denyUrl, emailed: Boolean(email && !skipEmail) };
}
