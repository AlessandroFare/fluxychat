export type HitlRiskTier = "high" | "medium" | "low";

export function routeHitlRisk(toolName: string): { tier: HitlRiskTier; defaultTimeoutSeconds: number } {
  const name = String(toolName || "").toLowerCase();
  if (/(delete|transfer|payout|exec|shell|deploy)/.test(name)) {
    return { tier: "high", defaultTimeoutSeconds: 1800 };
  }
  if (/(write|send|post|email|slack|webhook)/.test(name)) {
    return { tier: "medium", defaultTimeoutSeconds: 600 };
  }
  return { tier: "low", defaultTimeoutSeconds: 300 };
}
