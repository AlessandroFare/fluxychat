export interface AgentRunContext {
  runId: string;
  agentId: string;
  roomId?: string;
  userId?: string;
}

export interface AgentStepContext extends AgentRunContext {
  step: number;
  messages?: unknown[];
}

export interface AgentToolContext extends AgentRunContext {
  toolCallId: string;
  toolName: string;
  input: unknown;
  output?: unknown;
  error?: string;
}

export interface AgentLifecycleCallbacks {
  onStart?(ctx: AgentRunContext): void | Promise<void>;
  onStepStart?(ctx: AgentStepContext): void | Promise<void>;
  onStepEnd?(ctx: AgentStepContext): void | Promise<void>;
  onToolExecutionStart?(ctx: AgentToolContext): void | Promise<void>;
  onToolExecutionEnd?(ctx: AgentToolContext): void | Promise<void>;
}

export function createAgentLifecycleRunner(callbacks: AgentLifecycleCallbacks = {}) {
  return {
    async onStart(ctx: AgentRunContext) {
      await callbacks.onStart?.(ctx);
    },
    async onStepStart(ctx: AgentStepContext) {
      await callbacks.onStepStart?.(ctx);
    },
    async onStepEnd(ctx: AgentStepContext) {
      await callbacks.onStepEnd?.(ctx);
    },
    async onToolExecutionStart(ctx: AgentToolContext) {
      await callbacks.onToolExecutionStart?.(ctx);
    },
    async onToolExecutionEnd(ctx: AgentToolContext) {
      await callbacks.onToolExecutionEnd?.(ctx);
    },
  };
}
