/**
 * Off-room notification for a waiting ops approval (same spirit as
 * hitl-offroom-notify): when a run hits an approval step, the people who can
 * act are told outside the run room. Recipients are the run room's admins,
 * falling back to every room member - project roles live in JWTs, so the room
 * is the membership we can read. Each recipient gets an in-app row, a web push
 * and an email (honoring digest email preferences); admins additionally get
 * one-tap Approve/Deny links (single use, bound to the frozen payload hash);
 * the operator Slack webhook (HITL_SLACK_WEBHOOK_URL) gets one summary.
 */
import { sendDigestEmail } from "./digest-email.js";
import { getDigestPreferences } from "./daily-digest.js";
import { createInAppNotification } from "./in-app-notifications.js";
import { sendWebPushToUser } from "./push-notifications.js";
import { isOperatorSlackWebhookUrl } from "./hitl-offroom-notify.js";
import { trimTrailingSlashes } from "./trim-trailing-slashes.js";
import { hitlTapSecret, signHitlTapToken } from "./hitl-tap-token.js";

// shortcut: fan-out capped at 20 recipients per approval (one email + push
// each); raise the cap if incident rooms routinely exceed it.
const MAX_APPROVAL_RECIPIENTS = 20;
const TAP_TOKEN_MAX_TTL_MS = 24 * 3600_000;

export async function resolveOpsApprovalRecipients(env, { projectId, roomId }) {
  if (!env?.DB?.prepare || !projectId || !roomId) return [];
  const { results } = await env.DB.prepare(
    "SELECT user_id, role FROM room_members WHERE project_id = ? AND room_id = ?",
  )
    .bind(projectId, roomId)
    .all()
    .catch(() => ({ results: [] }));
  const members = (results || []).filter((row) => row?.user_id);
  const admins = members.filter((row) => row.role === "admin");
  const chosen = admins.length ? admins : members;
  const seen = new Set();
  const out = [];
  for (const row of chosen) {
    const userId = String(row.user_id);
    if (seen.has(userId)) continue;
    seen.add(userId);
    out.push({ userId, admin: row.role === "admin" });
  }
  return out;
}

async function resolveEmail(env, projectId, userId) {
  let prefs = null;
  try {
    prefs = await getDigestPreferences(env, projectId, userId);
  } catch {
    /* preferences table may be missing on old D1 */
  }
  if (prefs?.emailEnabled === false) return null;
  if (prefs?.emailEnabled && prefs.email) return String(prefs.email);
  const user = await env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(userId).first().catch(() => null);
  return user?.email ? String(user.email) : null;
}

export async function notifyOpsApprovalOffRoom(env, {
  projectId,
  roomId,
  runId,
  approvalId,
  stepId,
  tool,
  input,
  required,
  dueAt,
  payloadHash,
}) {
  const result = { recipients: 0, inApp: 0, pushed: 0, emailed: 0, slack: false };
  const resolved = await resolveOpsApprovalRecipients(env, { projectId, roomId }).catch(() => []);
  if (!resolved.length) return result;
  const recipients = resolved.slice(0, MAX_APPROVAL_RECIPIENTS);
  result.recipients = recipients.length;

  const title = `Approval needed: ${tool || "write step"}`;
  const body = `Run ${runId} step ${stepId} waits for ${Number(required) > 1 ? `${Number(required)} approvals` : "an approval"}. ${JSON.stringify(input || {}).slice(0, 400)}`;
  const appUrl = trimTrailingSlashes(env?.PUBLIC_APP_URL || env?.WORKER_PUBLIC_URL || "");
  const tapOrigin = trimTrailingSlashes(env?.WORKER_PUBLIC_URL || env?.PUBLIC_APP_URL || "");
  const dashboardUrl = appUrl ? `${appUrl}/ops/runs` : null;
  const now = Date.now();
  const dueMs = Date.parse(dueAt || "");
  const tokenExpMs = Math.min(
    Number.isFinite(dueMs) && dueMs > now ? dueMs : now + TAP_TOKEN_MAX_TTL_MS,
    now + TAP_TOKEN_MAX_TTL_MS,
  );
  const tapSecret = hitlTapSecret(env);

  for (const { userId, admin } of recipients) {
    try {
      await createInAppNotification(env, { projectId, userId, kind: "ops_approval", title, body, roomId });
      result.inApp += 1;
    } catch {
      /* best-effort per recipient */
    }
    try {
      // Force: the approval is time-bound (dueAt); high urgency wakes the
      // device instead of waiting for a power-saving delivery window.
      const push = await sendWebPushToUser(env, { projectId, userId, title, body, roomId, url: dashboardUrl || undefined, urgency: "high" });
      if (push?.sent) result.pushed += 1;
    } catch {
      /* best-effort per recipient */
    }
    try {
      const email = await resolveEmail(env, projectId, userId);
      if (email && dashboardUrl) {
        const lines = [body, `Expires: ${dueAt || "on step timeout"}`];
        if (admin && payloadHash && tapSecret) {
          const tapUrl = (token) => `${tapOrigin}/public/ops/approvals/tap?token=${encodeURIComponent(token)}`;
          const approve = await signHitlTapToken(tapSecret, {
            approvalId,
            action: "approve",
            userId,
            exp: tokenExpMs,
            payloadHash,
            kind: "ops",
            projectId,
          });
          const deny = await signHitlTapToken(tapSecret, {
            approvalId,
            action: "deny",
            userId,
            exp: tokenExpMs,
            payloadHash,
            kind: "ops",
            projectId,
          });
          if (approve) lines.push(`Approve: ${tapUrl(approve)}`);
          if (deny) lines.push(`Deny: ${tapUrl(deny)}`);
          lines.push("One tap, single use, bound to the frozen payload. The link only opens a confirmation page.");
        }
        lines.push(`Open: ${dashboardUrl}`);
        await sendDigestEmail(env, { to: email, subject: title, textBody: lines.join("\n") });
        result.emailed += 1;
      }
    } catch {
      /* best-effort per recipient */
    }
  }

  try {
    const slack = String(env?.HITL_SLACK_WEBHOOK_URL || "").trim();
    if (isOperatorSlackWebhookUrl(slack)) {
      await fetch(slack, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        redirect: "manual",
        body: JSON.stringify({
          text: `FluxyChat approval needed: ${body}${dashboardUrl ? ` — open ${dashboardUrl}` : ""} (approval ${approvalId})`,
        }),
      });
      result.slack = true;
    }
  } catch {
    /* best-effort */
  }

  return result;
}

/**
 * Page the on-call assignee after a step timeout escalated the task to them
 * (`timeout.onTimeout: "escalate"`). In-app + web push: the page must reach the
 * phone, and the room notification for the approval already went out.
 */
export async function notifyOpsTaskEscalation(env, {
  projectId,
  roomId,
  runId,
  userId,
  stepId,
  taskId,
  dueAt,
}) {
  const result = { notified: false, pushed: 0, emailed: 0 };
  if (!env?.DB?.prepare || !projectId || !userId) return result;
  const title = "On-call page: a run is waiting on you";
  const body = `Run ${runId} step ${stepId} timed out and was escalated to you.${dueAt ? ` Next deadline: ${dueAt}.` : ""}`;
  const appUrl = trimTrailingSlashes(env?.PUBLIC_APP_URL || env?.WORKER_PUBLIC_URL || "");
  const dashboardUrl = appUrl ? `${appUrl}/ops/runs` : null;

  try {
    await createInAppNotification(env, { projectId, userId, kind: "ops_escalation", title, body, roomId });
    result.notified = true;
  } catch {
    /* best-effort */
  }
  try {
    const push = await sendWebPushToUser(env, { projectId, userId, title, body, roomId, url: dashboardUrl || undefined, urgency: "high" });
    if (push?.sent) {
      result.pushed = push.sent;
      result.notified = true;
    }
  } catch {
    /* best-effort */
  }
  try {
    const email = await resolveEmail(env, projectId, userId);
    if (email) {
      await sendDigestEmail(env, { to: email, subject: title, textBody: [body, dashboardUrl ? `Open: ${dashboardUrl}` : ""].filter(Boolean).join("\n") });
      result.emailed = 1;
    }
  } catch {
    /* best-effort */
  }
  return { ...result, taskId };
}
