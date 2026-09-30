import type { FluxyAgentPolicy, FluxyConfig } from "./types.js";

export function resolveAgentPolicy(config: FluxyConfig | null | undefined, agentId: string): FluxyAgentPolicy {
  const agents = config?.agents;
  if (!agents) return {};
  const exact = agents[agentId];
  if (exact) return exact;
  const star = agents["*"];
  return star ?? {};
}
