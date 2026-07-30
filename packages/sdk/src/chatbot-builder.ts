export type TriggerEvent =
  | { type: "message_received"; filters?: { keyword?: string; senderRole?: string; channelType?: string } }
  | { type: "user_joined"; filters?: { channelType?: string } }
  | { type: "user_left"; filters?: {} }
  | { type: "reaction_added"; filters?: { emoji?: string } }
  | { type: "ticket_created"; filters?: { priority?: string } }
  | { type: "schedule"; filters?: { cron?: string; timezone?: string } };

export type TriggerEventType = TriggerEvent["type"];

export type ActionType =
  | "send_message"
  | "create_ticket"
  | "assign_agent"
  | "send_webhook"
  | "update_tags"
  | "trigger_workflow"
  | "run_llm_prompt";

export interface Action {
  type: ActionType;
  params: Record<string, unknown>;
}

export interface WorkflowRule {
  id: string;
  name: string;
  description?: string;
  trigger: TriggerEvent;
  conditions?: Array<{ field: string; operator: "eq" | "neq" | "contains" | "gt" | "lt"; value: unknown }>;
  actions: Action[];
  enabled: boolean;
  priority: number;
  createdAt: number;
}

export interface WorkflowExecution {
  ruleId: string;
  triggeredBy: TriggerEvent;
  matchedConditions: boolean;
  executedActions: { action: Action; success: boolean; result?: unknown; error?: string }[];
  executedAt: number;
}

export interface ChatbotBuilder {
  addRule(rule: Omit<WorkflowRule, "id" | "createdAt">): WorkflowRule;
  updateRule(id: string, updates: Partial<WorkflowRule>): WorkflowRule;
  removeRule(id: string): boolean;
  getRule(id: string): WorkflowRule | undefined;
  listRules(): WorkflowRule[];
  evaluateTrigger(event: TriggerEvent, context?: Record<string, unknown>): Promise<WorkflowExecution[]>;
  getExecutionHistory(): WorkflowExecution[];
  clearHistory(): void;
}

export function createChatbotBuilder(): ChatbotBuilder {
  const rules = new Map<string, WorkflowRule>();
  const history: WorkflowExecution[] = [];
  let ruleCounter = 0;

  function evaluateConditions(
    conditions: WorkflowRule["conditions"],
    context: Record<string, unknown>,
  ): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((c) => {
      const val = context[c.field];
      switch (c.operator) {
        case "eq": return val === c.value;
        case "neq": return val !== c.value;
        case "contains": return String(val).includes(String(c.value));
        case "gt": return Number(val) > Number(c.value);
        case "lt": return Number(val) < Number(c.value);
        default: return false;
      }
    });
  }

  function matchTrigger(trigger: TriggerEvent, event: TriggerEvent): boolean {
    if (trigger.type !== event.type) return false;
    if (trigger.filters) {
      for (const [key, val] of Object.entries(trigger.filters)) {
        const eventVal = (event.filters as Record<string, unknown>)?.[key];
        if (val !== undefined && eventVal !== val) return false;
      }
    }
    return true;
  }

  return {
    addRule(input) {
      const id = `rule-${++ruleCounter}`;
      const rule: WorkflowRule = { ...input, id, createdAt: Date.now() };
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

    async evaluateTrigger(event, context = {}) {
      const results: WorkflowExecution[] = [];
      const sorted = Array.from(rules.values())
        .filter((r) => r.enabled)
        .sort((a, b) => a.priority - b.priority);

      for (const rule of sorted) {
        if (!matchTrigger(rule.trigger, event)) continue;
        const matched = evaluateConditions(rule.conditions, context);
        const executedActions = rule.actions.map((action) => {
          try {
            return { action, success: true, result: `executed ${action.type}` };
          } catch (e) {
            return { action, success: false, error: String(e) };
          }
        });

        const execution: WorkflowExecution = {
          ruleId: rule.id,
          triggeredBy: event,
          matchedConditions: matched,
          executedActions,
          executedAt: Date.now(),
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
