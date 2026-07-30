import type { FluxyChatClient } from "./index";
import type { ModerationAction } from "./ai-moderation";

export interface ModerationLabelResult {
  labels: string[];
  scores: Record<string, number>;
  severity: string;
  source: string;
  taxonomy?: string[];
  reason?: string;
  suggestedAction?: string;
}

export interface ModerationLabelsClient {
  classify(content: string, options?: { roomId?: string; useAi?: boolean }): Promise<ModerationLabelResult>;
}

export function createModerationLabelsClient(client: FluxyChatClient): ModerationLabelsClient {
  return {
    async classify(content, options = {}) {
      await client.resolveToken?.();
      const headers = (client as unknown as { authHeaders?: () => HeadersInit }).authHeaders?.();
      const base = (client as unknown as { baseUrl?: string }).baseUrl ?? "";
      const res = await fetch(`${base}/moderation/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          content,
          roomId: options.roomId,
          useAi: options.useAi ?? false,
        }),
      });
      if (!res.ok) throw new Error(`moderation labels failed: ${res.status}`);
      return (await res.json()) as ModerationLabelResult;
    },
  };
}

export type RuleConditionOp = "eq" | "neq" | "includes" | "gt" | "lt";

export interface RuleCondition {
  field: "label" | "severity" | "accountAgeHours" | "messageCount";
  op: RuleConditionOp;
  value: string | number | string[];
}

export interface ModerationRuleDefinition {
  name: string;
  match: "all" | "any";
  conditions: RuleCondition[];
  action: ModerationAction;
}

export interface RuleBuilderContext {
  labels: string[];
  scores: Record<string, number>;
  severity: string;
  accountAgeHours?: number;
  messageCount?: number;
}

function evalCondition(condition: RuleCondition, ctx: RuleBuilderContext): boolean {
  if (condition.field === "label") {
    const labels = ctx.labels;
    const val = condition.value;
    if (condition.op === "eq") return labels.includes(String(val));
    if (condition.op === "neq") return !labels.includes(String(val));
    if (condition.op === "includes" && Array.isArray(val)) return val.some((l) => labels.includes(l));
    return false;
  }
  if (condition.field === "severity") {
    const order = ["none", "low", "medium", "high", "critical"];
    const idx = order.indexOf(ctx.severity);
    const target = order.indexOf(String(condition.value));
    if (condition.op === "eq") return idx === target;
    if (condition.op === "gt") return idx > target;
    if (condition.op === "neq") return idx !== target;
    return false;
  }
  if (condition.field === "accountAgeHours" && typeof condition.value === "number") {
    const age = ctx.accountAgeHours ?? 0;
    if (condition.op === "lt") return age < condition.value;
    if (condition.op === "gt") return age > condition.value;
  }
  if (condition.field === "messageCount" && typeof condition.value === "number") {
    const count = ctx.messageCount ?? 0;
    if (condition.op === "gt") return count > condition.value;
    if (condition.op === "eq") return count === condition.value;
  }
  return false;
}

/** Portal/Stream-style no-code rule evaluation over label classification results. */
export function evaluateModerationRules(
  rules: ModerationRuleDefinition[],
  ctx: RuleBuilderContext,
): Array<{ rule: ModerationRuleDefinition; action: ModerationAction }> {
  const hits: Array<{ rule: ModerationRuleDefinition; action: ModerationAction }> = [];
  for (const rule of rules) {
    const results = rule.conditions.map((c) => evalCondition(c, ctx));
    const matched = rule.match === "all" ? results.every(Boolean) : results.some(Boolean);
    if (matched) hits.push({ rule, action: rule.action });
  }
  return hits;
}
