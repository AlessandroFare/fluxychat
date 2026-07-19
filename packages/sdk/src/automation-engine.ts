export type TriggerEventType =
  | "message.sent"
  | "message.received"
  | "user.joined"
  | "user.left"
  | "reaction.added"
  | "ticket.created"
  | "ticket.updated"
  | "schedule.cron"
  | "webhook.received";

export interface TriggerDef {
  event: TriggerEventType;
  filters?: Record<string, unknown>;
}

export interface ActionDef {
  type: "send_message" | "create_ticket" | "assign_agent" | "call_webhook" | "run_script" | "update_field" | "notify";
  params: Record<string, unknown>;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: TriggerDef;
  conditions?: string;
  actions: ActionDef[];
  enabled: boolean;
  priority: number;
  cooldownMs?: number;
  createdAt: number;
}

export interface AutomationExecution {
  ruleId: string;
  trigger: TriggerDef;
  matched: boolean;
  actions: Array<{ def: ActionDef; success: boolean; result?: string }>;
  executedAt: number;
}

export interface AutomationEngine {
  addRule(rule: Omit<AutomationRule, "id" | "createdAt">): AutomationRule;
  updateRule(id: string, updates: Partial<AutomationRule>): AutomationRule;
  removeRule(id: string): boolean;
  getRule(id: string): AutomationRule | undefined;
  listRules(): AutomationRule[];
  trigger(event: TriggerDef, context?: Record<string, unknown>): Promise<AutomationExecution[]>;
  getExecutionHistory(): AutomationExecution[];
  clearHistory(): void;
}

export function createAutomationEngine(): AutomationEngine {
  const rules = new Map<string, AutomationRule>();
  const history: AutomationExecution[] = [];
  const lastTriggered = new Map<string, number>();
  let ruleCounter = 0;

  return {
    addRule(input) {
      const id = `auto-${++ruleCounter}`;
      const rule: AutomationRule = { ...input, id, createdAt: Date.now() };
      rules.set(id, rule);
      return { ...rule };
    },

    updateRule(id, updates) {
      const existing = rules.get(id);
      if (!existing) throw new Error(`Rule "${id}" not found`);
      const updated = { ...existing, ...updates };
      rules.set(id, updated);
      return { ...updated };
    },

    removeRule(id) {
      return rules.delete(id);
    },

    getRule(id) {
      return rules.get(id);
    },

    listRules() {
      return Array.from(rules.values()).sort((a, b) => a.priority - b.priority);
    },

    async trigger(event, _context = {}) {
      const results: AutomationExecution[] = [];
      const now = Date.now();

      for (const rule of Array.from(rules.values()).filter((r) => r.enabled).sort((a, b) => a.priority - b.priority)) {
        if (rule.trigger.event !== event.event) continue;

        if (rule.cooldownMs) {
          const last = lastTriggered.get(rule.id) ?? 0;
          if (now - last < rule.cooldownMs) continue;
        }
        lastTriggered.set(rule.id, now);

        const executedActions = rule.actions.map((def) => ({
          def,
          success: true,
          result: `executed ${def.type}`,
        }));

        const execution: AutomationExecution = {
          ruleId: rule.id,
          trigger: event,
          matched: true,
          actions: executedActions,
          executedAt: now,
        };
        history.push(execution);
        results.push(execution);
      }
      return results;
    },

    getExecutionHistory() {
      return [...history];
    },

    clearHistory() {
      history.length = 0;
    },
  };
}
