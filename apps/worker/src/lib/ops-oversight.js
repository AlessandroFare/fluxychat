/**
 * Oversight health for the ops layer: are human approvals real reviews or
 * rubber stamps? Computed from approval decision timestamps (each decision is
 * `{ actor, decision, at }`) plus the tool-call denial events. It feeds the
 * ops console and the project evidence pack; it is not a compliance verdict.
 */

/** A decision faster than this is counted as "fast" (rubber-stamp signal). */
export const OVERSIGHT_FAST_DECISION_SECONDS = 10;
/** Below this sample size no rubber-stamp signal is raised. */
export const OVERSIGHT_MIN_SAMPLE = 5;
/** Share of fast decisions that raises the signal. */
export const OVERSIGHT_FAST_SHARE = 0.8;

function inPeriod(iso, from, to) {
  if (!iso) return !from && !to;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The decision that closed the approval: the required-th approve, or the deny. */
function decisiveAt(approval) {
  const decisions = Array.isArray(approval.decisions) ? approval.decisions : [];
  if (approval.status === "denied") {
    const deny = decisions.find((item) => item.decision === "deny" && item.at);
    if (deny) return deny.at;
  }
  const required = Math.max(1, Number(approval.required) || 1);
  const approvals = decisions.filter((item) => item.decision === "approve" && item.at);
  return approvals.length >= required ? approvals[required - 1].at : null;
}

function secondsBetween(startIso, endIso) {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 1000;
}

/**
 * @param {Array} approvals - ops approvals (raw rows, decisions included)
 * @param {Object} [opts]
 * @param {Array} [opts.events] - ops events already scoped to the period
 * @param {string|null} [opts.from] - ISO lower bound on approval.createdAt
 * @param {string|null} [opts.to] - ISO upper bound
 */
export function computeOversight(approvals = [], {
  events = [],
  from = null,
  to = null,
  fastSeconds = OVERSIGHT_FAST_DECISION_SECONDS,
} = {}) {
  const scoped = (Array.isArray(approvals) ? approvals : []).filter((approval) =>
    inPeriod(approval?.createdAt, from, to),
  );
  const decidedRows = scoped.filter((approval) => approval.status === "approved" || approval.status === "denied");

  const durations = [];
  for (const approval of decidedRows) {
    const at = decisiveAt(approval);
    const seconds = at ? secondsBetween(approval.createdAt, at) : null;
    if (seconds != null) durations.push(seconds);
  }

  const distinct = new Set();
  for (const approval of scoped) {
    for (const decision of approval.decisions || []) {
      if (decision?.actor && (decision.decision === "approve" || decision.decision === "deny")) {
        distinct.add(decision.actor);
      }
    }
  }

  const multi = decidedRows.filter((approval) => (Number(approval.required) || 1) > 1);
  let quorumMet = 0;
  for (const approval of multi) {
    if (approval.status !== "approved") continue;
    const required = Math.max(2, Number(approval.required) || 2);
    const approvers = new Set(
      (approval.decisions || [])
        .filter((decision) => decision.decision === "approve" && decision.actor)
        .map((decision) => decision.actor),
    );
    if (approvers.size >= required) quorumMet += 1;
  }

  const fast = durations.filter((seconds) => seconds < fastSeconds).length;
  const fastShare = durations.length ? fast / durations.length : null;

  return {
    from,
    to,
    fastSeconds,
    requested: scoped.length,
    pending: scoped.filter((approval) => approval.status === "pending").length,
    decided: decidedRows.length,
    approved: scoped.filter((approval) => approval.status === "approved").length,
    denied: scoped.filter((approval) => approval.status === "denied").length,
    medianDecisionSeconds: median(durations),
    fastDecisions: fast,
    fastShare,
    quorumRequested: multi.length,
    quorumMet,
    quorumRate: multi.length ? quorumMet / multi.length : null,
    distinctApprovers: distinct.size,
    toolDenials: (Array.isArray(events) ? events : []).filter((event) => event?.eventType === "ops.tool.denied").length,
    // Signal only with enough data: one fast approval proves nothing.
    rubberStamp: durations.length >= OVERSIGHT_MIN_SAMPLE && fastShare >= OVERSIGHT_FAST_SHARE,
  };
}
