/**
 * Coarse HITL routing from tool name / cost. Not a legal risk class.
 */
export function routeHitlRisk({ toolName, estimatedCostUsd = null } = {}) {
  const name = String(toolName || "").toLowerCase();
  const cost = typeof estimatedCostUsd === "number" ? estimatedCostUsd : 0;
  if (cost >= 1 || /(delete|transfer|payout|exec|shell|deploy)/.test(name)) {
    return { tier: "high", defaultTimeoutSeconds: 1800 };
  }
  if (cost >= 0.1 || /(write|send|post|email|slack|webhook)/.test(name)) {
    return { tier: "medium", defaultTimeoutSeconds: 600 };
  }
  return { tier: "low", defaultTimeoutSeconds: 300 };
}
