/**
 * Named retry taxonomy for Durable Object wakes (CF-A-021).
 *
 * Cloudflare Agents classifies isolate recycles (code deploy, OOM, network)
 * instead of treating every alarm re-entry as a generic failure. We do the
 * same so room alarms and scheduled agent fires can retry transients and
 * not loop on fatal resets.
 */

export const RETRY_CODES = {
  code_update: "code_update",
  oom: "oom",
  transient: "transient",
  abort: "abort",
  fatal: "fatal",
  unknown: "unknown",
};

export const LAST_WAKE_STORAGE_KEY = "do:last-wake:v1";

const CODE_UPDATE_RE =
  /code was updated|durable object reset because its code|script updated|worker threw exception during startup/i;
const OOM_RE = /memory limit|out of memory|exceeded memory|oom/i;
const TRANSIENT_RE =
  /network connection lost|internal error|overloaded|timeout|temporar|unavailable|try again|econnreset|fetch failed/i;
const ABORT_RE = /abort(ed)?|cancelled|canceled/i;

/**
 * @param {unknown} err
 * @returns {{
 *   code: string,
 *   retry: boolean,
 *   delayMs: number,
 *   message: string,
 * }}
 */
export function classifyDoFailure(err) {
  const message = err instanceof Error ? err.message : String(err || "unknown");
  const name = err instanceof Error ? err.name : "";
  const hay = `${name} ${message}`;

  if (CODE_UPDATE_RE.test(hay)) {
    return { code: RETRY_CODES.code_update, retry: true, delayMs: 250, message };
  }
  if (OOM_RE.test(hay)) {
    return { code: RETRY_CODES.oom, retry: false, delayMs: 0, message };
  }
  if (ABORT_RE.test(hay)) {
    return { code: RETRY_CODES.abort, retry: false, delayMs: 0, message };
  }
  if (TRANSIENT_RE.test(hay)) {
    return { code: RETRY_CODES.transient, retry: true, delayMs: 1_000, message };
  }
  if (err && typeof err === "object" && err.retryable === true) {
    return { code: RETRY_CODES.transient, retry: true, delayMs: 1_000, message };
  }
  if (err && typeof err === "object" && err.retryable === false) {
    return { code: RETRY_CODES.fatal, retry: false, delayMs: 0, message };
  }
  return { code: RETRY_CODES.unknown, retry: false, delayMs: 0, message };
}

export function backoffMsForFailure(classification, failCount = 0) {
  if (!classification?.retry) return 0;
  const base = Number(classification.delayMs) || 1_000;
  const n = Math.min(Math.max(Number(failCount) || 0, 0), 6);
  return Math.min(30 * 60 * 1000, base * 2 ** n);
}

/**
 * @param {{ get: Function, put: Function }} storage
 * @param {object} wake
 */
export async function recordDoWake(storage, wake) {
  if (!storage?.put) return;
  await storage.put(LAST_WAKE_STORAGE_KEY, {
    at: Date.now(),
    reason: wake?.reason || "alarm",
    code: wake?.code || RETRY_CODES.unknown,
    retry: Boolean(wake?.retry),
    message: wake?.message ? String(wake.message).slice(0, 300) : null,
  });
}

export async function readLastDoWake(storage) {
  if (!storage?.get) return null;
  const row = await storage.get(LAST_WAKE_STORAGE_KEY);
  return row && typeof row === "object" ? row : null;
}

/**
 * Wrap a DO alarm step. Transient/code-update errors are recorded and
 * rethrown only when the caller asked to propagate; OOM/fatal stay named.
 *
 * @param {{ storage?: { get: Function, put: Function } }} state
 * @param {() => Promise<unknown>} fn
 */
export async function runDoAlarmStep(state, fn, { reason = "alarm" } = {}) {
  try {
    const out = await fn();
    await recordDoWake(state?.storage, {
      reason,
      code: "ok",
      retry: false,
      message: null,
    });
    return { ok: true, result: out };
  } catch (err) {
    const classified = classifyDoFailure(err);
    await recordDoWake(state?.storage, {
      reason,
      code: classified.code,
      retry: classified.retry,
      message: classified.message,
    });
    return { ok: false, ...classified, error: err };
  }
}
