import { logError } from "./worker-log.js";
import { schedulePostMessageAutomations } from "./post-message-automations.js";

/**
 * Audit A-6: safe wrapper around `schedulePostMessageAutomations` that
 * catches any synchronous or asynchronous error, writes a row to
 * `operational_audit_events`, and NEVER re-throws. This is the only
 * function that should be called from per-request hot paths or from
 * Durable Object message handlers.
 *
 * Background: a swallowed exception in a fire-and-forget call site
 * (e.g. `void schedulePostMessageAutomations(...)`) was previously
 * invisible to operators. With this wrapper, every failure is
 * captured with the message id and room id, so an operator can
 * correlate the failure back to the message that triggered it.
 */

const AUTOMATION_EXCEPTION_AUDIT_SQL = `
  INSERT INTO operational_audit_events
    (project_id, event_type, message_id, room_id, error_message, error_stack, created_at)
  VALUES (?, 'AUTOMATION_EXCEPTION', ?, ?, ?, ?, ?)
`;

let auditTableEnsured = false;
async function ensureAuditTable(env) {
  if (auditTableEnsured) return;
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS operational_audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        message_id TEXT,
        room_id TEXT,
        user_id TEXT,
        error_message TEXT,
        error_stack TEXT,
        details TEXT,
        created_at TEXT NOT NULL
      )
    `).run();
    auditTableEnsured = true;
  } catch (err) {
    // Don't block the call site if the table create fails  just log.
    logError("operational_audit_events.create_failed", err);
  }
}

/**
 * Fire-and-forget safe wrapper. Returns a promise that resolves to
 * `{ ok: true }` or `{ ok: false, error }`  never throws.
 */
export async function safeSchedulePostMessageAutomations(env, detail) {
  try {
    await schedulePostMessageAutomations(env, detail);
    return { ok: true };
  } catch (err) {
    const projectId = detail?.projectId || null;
    const messageId = detail?.messageId != null ? String(detail.messageId) : null;
    const roomId = detail?.roomId || null;
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? String(err.stack || "").slice(0, 500) : null;

    logError("automation.exception", err, { projectId, messageId, roomId });

    try {
      await ensureAuditTable(env);
      await env.DB.prepare(AUTOMATION_EXCEPTION_AUDIT_SQL)
        .bind(projectId, messageId, roomId, errorMessage, errorStack, new Date().toISOString())
        .run();
    } catch (auditErr) {
      // If we cannot write the audit row, we still swallowed the
      // original error  the logError above is the last-resort trail.
      logError("automation.exception_audit_failed", auditErr, { projectId, messageId, roomId });
    }

    return { ok: false, error: errorMessage };
  }
}
