/**
 * Configurable per-room HITL approval chain (steps + fallback).
 */

export const DEFAULT_APPROVAL_TIMEOUT_SECONDS = 180;
export const MIN_STEP_TIMEOUT_SECONDS = 30;
export const MAX_STEP_TIMEOUT_SECONDS = 86400;
export const MAX_CHAIN_STEPS = 20;

/**
 * @typedef {{ approverId?: string, timeoutSeconds?: number, fallback?: string }} ApprovalChainStep
 * @typedef {{ steps?: ApprovalChainStep[], defaultTimeoutSeconds?: number }} ApprovalChainConfig
 */

/**
 * @param {unknown} raw
 * @returns {{ ok: true, chain: ApprovalChainConfig } | { ok: false, error: string }}
 */
export function parseApprovalChain(raw) {
  if (raw == null) {
    return { ok: true, chain: { steps: [], defaultTimeoutSeconds: DEFAULT_APPROVAL_TIMEOUT_SECONDS } };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "invalid_approval_chain" };
  }

  const input = /** @type {ApprovalChainConfig} */ (raw);
  const defaultTimeoutSeconds = clampTimeout(
    input.defaultTimeoutSeconds ?? DEFAULT_APPROVAL_TIMEOUT_SECONDS,
  );
  const stepsRaw = Array.isArray(input.steps) ? input.steps : [];

  if (stepsRaw.length > MAX_CHAIN_STEPS) {
    return { ok: false, error: "approval_chain_too_long" };
  }

  const steps = [];
  for (const step of stepsRaw) {
    if (!step || typeof step !== "object") {
      return { ok: false, error: "invalid_approval_step" };
    }
    if (step.fallback != null) {
      const fallback = String(step.fallback).trim();
      if (!fallback) return { ok: false, error: "invalid_fallback_step" };
      steps.push({ fallback });
      continue;
    }
    const approverId = String(step.approverId ?? "").trim();
    if (!approverId || approverId.length > 128) {
      return { ok: false, error: "invalid_approver_id" };
    }
    steps.push({
      approverId,
      timeoutSeconds: clampTimeout(step.timeoutSeconds ?? defaultTimeoutSeconds),
    });
  }

  return { ok: true, chain: { steps, defaultTimeoutSeconds } };
}

function clampTimeout(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_APPROVAL_TIMEOUT_SECONDS;
  return Math.min(MAX_STEP_TIMEOUT_SECONDS, Math.max(MIN_STEP_TIMEOUT_SECONDS, Math.floor(n)));
}

/**
 * Snapshot chain for persistence on approval_requested (immutable copy).
 * @param {ApprovalChainConfig} chain
 */
export function snapshotApprovalChain(chain) {
  return JSON.parse(JSON.stringify(chain ?? { steps: [], defaultTimeoutSeconds: DEFAULT_APPROVAL_TIMEOUT_SECONDS }));
}

/**
 * Resolve current approver user id for a step index.
 * @param {ApprovalChainStep[]} steps
 * @param {number} stepIndex
 * @returns {{ approverId: string | null, isFallback: boolean, fallback?: string }}
 */
export function resolveApproverAtStep(steps, stepIndex) {
  const step = steps[stepIndex];
  if (!step) return { approverId: null, isFallback: false };
  if (step.fallback) return { approverId: null, isFallback: true, fallback: step.fallback };
  return { approverId: step.approverId ?? null, isFallback: false };
}

/**
 * Timeout for a step (seconds).
 * @param {ApprovalChainStep} step
 * @param {number} defaultTimeoutSeconds
 */
export function stepTimeoutSeconds(step, defaultTimeoutSeconds) {
  if (step?.fallback) return defaultTimeoutSeconds;
  return clampTimeout(step?.timeoutSeconds ?? defaultTimeoutSeconds);
}
