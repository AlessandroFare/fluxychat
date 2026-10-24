/**
 * I2: adaptive gates — a statically allowed tool call still gets a second pair
 * of eyes when the behavior around it is unusual. Three signals, all computed
 * from the tool-call log already in house:
 *
 *   • first_use  — the project has never executed this tool before;
 *   • off_hours  — the call lands inside the configured UTC office-off range;
 *   • spike      — the current window is many times the rolling baseline.
 *
 * The gate never replaces a static approval: it only applies to tools whose
 * registry entry does NOT require approval (for those, the workflow's own
 * approval step already put a human in the loop). The engine binds an approval
 * to the frozen { tool, input } — the same hash the gateway verifies — so an
 * approved gate grants exactly this call.
 */

export function normalizeAdaptiveGates(raw) {
  const base = { enabled: false, firstUse: false, offHours: null, spike: null, approveRoles: ["owner"] };
  if (!raw || typeof raw !== "object") return base;
  const from = Math.floor(Number(raw.offHours?.from));
  const to = Math.floor(Number(raw.offHours?.to));
  const offHours =
    Number.isFinite(from) && Number.isFinite(to) && from >= 0 && from <= 23 && to >= 0 && to <= 23 && from !== to
      ? { from, to }
      : null;
  const multiplier = Number(raw.spike?.multiplier);
  const windowMinutes = Math.floor(Number(raw.spike?.windowMinutes));
  const lookbackHours = Math.floor(Number(raw.spike?.lookbackHours));
  const minSamples = Math.floor(Number(raw.spike?.minSamples));
  const spike =
    Number.isFinite(multiplier) && multiplier >= 1.1 && multiplier <= 100 &&
    Number.isFinite(windowMinutes) && windowMinutes >= 1 && windowMinutes <= 1440 &&
    Number.isFinite(lookbackHours) && lookbackHours >= 1 && lookbackHours <= 168 &&
    Number.isFinite(minSamples) && minSamples >= 1 && minSamples <= 1000
      ? { multiplier, windowMinutes, lookbackHours, minSamples }
      : null;
  const roles = Array.isArray(raw.approveRoles)
    ? raw.approveRoles.map((role) => String(role || "").trim()).filter(Boolean).slice(0, 10)
    : [];
  return {
    enabled: raw.enabled === true || raw.enabled === "true" || raw.enabled === 1,
    firstUse: raw.firstUse === true || raw.firstUse === "true" || raw.firstUse === 1,
    offHours,
    spike,
    approveRoles: roles.length ? roles : base.approveRoles,
  };
}

/** Wraparound is normal: 20 → 7 means the range crosses midnight. */
export function offHoursMatch(range, hour) {
  if (!range) return false;
  const { from, to } = range;
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
}

/**
 * @returns {Promise<string[]>} gate reasons, empty = let it run.
 */
export async function evaluateAdaptiveGate(store, { projectId, tool, gates, now = Date.now() }) {
  const config = normalizeAdaptiveGates(gates);
  if (!config.enabled) return [];
  const reasons = [];
  if (config.firstUse) {
    const prior = await store.countToolCallsSince(projectId, { tool, since: null });
    if (prior === 0) reasons.push("first_use");
  }
  if (config.offHours && offHoursMatch(config.offHours, new Date(now).getUTCHours())) {
    reasons.push("off_hours");
  }
  if (config.spike) {
    const { multiplier, windowMinutes, lookbackHours, minSamples } = config.spike;
    const inWindow = await store.countToolCallsSince(projectId, {
      tool,
      since: new Date(now - windowMinutes * 60_000).toISOString(),
    });
    const inLookback = await store.countToolCallsSince(projectId, {
      tool,
      since: new Date(now - lookbackHours * 3_600_000).toISOString(),
    });
    // Baseline = average per window outside the current one; a floor of 1 call
    // keeps a quiet tool from tripping on its second call of the afternoon.
    const windows = Math.max(1, Math.floor((lookbackHours * 60) / windowMinutes) - 1);
    const baseline = Math.max((inLookback - inWindow) / windows, 1);
    if (inWindow >= minSamples && inWindow > multiplier * baseline) reasons.push("spike");
  }
  return reasons;
}
