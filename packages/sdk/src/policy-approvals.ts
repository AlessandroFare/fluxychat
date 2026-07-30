export type PolicyEffect = "allow" | "deny" | "shadow_deny";
export type PolicyMode = "enforcing" | "shadow" | "disabled";

export interface OpaPolicy {
  policyId: string;
  name: string;
  rego: string;
  mode: PolicyMode;
  transitive: boolean;
  priority: number;
  createdAt: string;
}

export interface PolicyInput {
  action: string;
  resource: string;
  subject: { id: string; roles: string[]; attributes: Record<string, unknown> };
  context: Record<string, unknown>;
}

export interface PolicyDecision {
  allowed: boolean;
  effect: PolicyEffect;
  policyId: string;
  matchedRules: string[];
  obligations: string[];
  timestamp: string;
}

export interface PolicyEngine {
  addPolicy(policy: Omit<OpaPolicy, "createdAt">): OpaPolicy;
  removePolicy(policyId: string): void;
  getPolicy(policyId: string): OpaPolicy | null;
  listPolicies(): OpaPolicy[];
  evaluate(input: PolicyInput): PolicyDecision;
  evaluateTransitive(input: PolicyInput): PolicyDecision;
}

function matchRule(rego: string, input: PolicyInput): { matched: boolean; matchedRules: string[]; obligations: string[] } {
  const matchedRules: string[] = [];
  const obligations: string[] = [];

  const lines = rego.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.includes("allow") && !trimmed.startsWith("#")) {
      matchedRules.push(trimmed);
      obligations.push("audit_required");
    }
    if (trimmed.includes("deny") && !trimmed.startsWith("#")) {
      matchedRules.push(trimmed);
      obligations.push("block_notification");
    }
  }

  return {
    matched: matchedRules.length > 0,
    matchedRules,
    obligations: [...new Set(obligations)],
  };
}

export function createPolicyEngine(): PolicyEngine {
  const policies = new Map<string, OpaPolicy>();

  return {
    addPolicy(policy: Omit<OpaPolicy, "createdAt">): OpaPolicy {
      const full: OpaPolicy = { ...policy, createdAt: new Date().toISOString() };
      policies.set(policy.policyId, full);
      return full;
    },

    removePolicy(policyId: string): void {
      policies.delete(policyId);
    },

    getPolicy(policyId: string) { return policies.get(policyId) ?? null; },

    listPolicies() {
      return [...policies.values()].sort((a, b) => b.priority - a.priority);
    },

    evaluate(input: PolicyInput): PolicyDecision {
      const sorted = [...policies.values()].sort((a, b) => b.priority - a.priority);

      for (const policy of sorted) {
        if (policy.mode === "disabled") continue;
        const result = matchRule(policy.rego, input);

        if (result.matched) {
          const isDeny = result.matchedRules.some((r) => r.toLowerCase().includes("deny"));
          const effect: PolicyEffect = policy.mode === "shadow" ? "shadow_deny" : isDeny ? "deny" : "allow";

          return {
            allowed: policy.mode === "shadow" ? true : effect === "allow",
            effect,
            policyId: policy.policyId,
            matchedRules: result.matchedRules,
            obligations: result.obligations,
            timestamp: new Date().toISOString(),
          };
        }
      }

      return {
        allowed: true,
        effect: "allow",
        policyId: "default",
        matchedRules: [],
        obligations: [],
        timestamp: new Date().toISOString(),
      };
    },

    evaluateTransitive(input: PolicyInput): PolicyDecision {
      const decision = this.evaluate(input);
      if (!decision.allowed && decision.effect !== "shadow_deny") {
        const parentInput: PolicyInput = {
          ...input,
          context: { ...input.context, parent_decision: decision },
        };
        return this.evaluate(parentInput);
      }
      return decision;
    },
  };
}
