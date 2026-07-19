import { createLogger } from "./logger";

export interface TelemetryEvent {
  type: string;
  timestamp: number;
  functionId?: string;
  modelId?: string;
  provider?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  durationMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TelemetrySpan {
  id: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, unknown>;
  status: "ok" | "error";
  children: TelemetrySpan[];
}

export type TelemetryLifecycleEvent =
  | { phase: "onStart"; event: TelemetryEvent }
  | { phase: "onEnd"; event: TelemetryEvent }
  | { phase: "onStepStart"; event: TelemetryEvent }
  | { phase: "onStepEnd"; event: TelemetryEvent }
  | { phase: "onLanguageModelCallStart"; event: TelemetryEvent }
  | { phase: "onLanguageModelCallEnd"; event: TelemetryEvent }
  | { phase: "onToolExecutionStart"; event: TelemetryEvent }
  | { phase: "onToolExecutionEnd"; event: TelemetryEvent }
  | { phase: "onAbort"; event: TelemetryEvent };

export interface TelemetryIntegration {
  onStart?(event: TelemetryEvent): void | Promise<void>;
  onEnd?(event: TelemetryEvent): void | Promise<void>;
  onStepStart?(event: TelemetryEvent): void | Promise<void>;
  onStepEnd?(event: TelemetryEvent): void | Promise<void>;
  onLanguageModelCallStart?(event: TelemetryEvent): void | Promise<void>;
  onLanguageModelCallEnd?(event: TelemetryEvent): void | Promise<void>;
  onToolExecutionStart?(event: TelemetryEvent): void | Promise<void>;
  onToolExecutionEnd?(event: TelemetryEvent): void | Promise<void>;
  onAbort?(event: TelemetryEvent): void | Promise<void>;
}

export interface TelemetryOptions {
  isEnabled?: boolean;
  recordInputs?: boolean;
  recordOutputs?: boolean;
  functionId?: string;
  metadata?: Record<string, unknown>;
}

export interface TelemetryManager {
  register(integration: TelemetryIntegration): void;
  unregister(integration: TelemetryIntegration): void;
  createSpan(name: string, parentId?: string): TelemetrySpan;
  endSpan(spanId: string, status?: "ok" | "error"): void;
  record(event: TelemetryLifecycleEvent): void;
  getSpans(): TelemetrySpan[];
  getEvents(): TelemetryLifecycleEvent[];
  getIntegrations(): TelemetryIntegration[];
}

export function createTelemetryManager(options?: TelemetryOptions): TelemetryManager {
  const integrations: TelemetryIntegration[] = [];
  const spans = new Map<string, TelemetrySpan>();
  const events: TelemetryLifecycleEvent[] = [];
  const isEnabled = options?.isEnabled ?? true;
  const log = createLogger();

  let spanCounter = 0;

  function generateSpanId(): string {
    return `span_${++spanCounter}_${Date.now()}`;
  }

  async function fanOut(phase: TelemetryLifecycleEvent["phase"], event: TelemetryEvent) {
    if (!isEnabled) return;
    for (const integration of integrations) {
      try {
        const handler = integration[phase as keyof TelemetryIntegration] as
          | ((e: TelemetryEvent) => void | Promise<void>)
          | undefined;
        await handler?.(event);
      } catch (err) {
        log.warn(`[telemetry] integration error in ${String(phase)}:`, err);
      }
    }
  }

  return {
    register(integration: TelemetryIntegration) {
      integrations.push(integration);
    },

    unregister(integration: TelemetryIntegration) {
      const idx = integrations.indexOf(integration);
      if (idx !== -1) integrations.splice(idx, 1);
    },

    createSpan(name: string, parentId?: string): TelemetrySpan {
      const id = generateSpanId();
      const span: TelemetrySpan = {
        id,
        parentId,
        name,
        startTime: Date.now(),
        attributes: {},
        status: "ok",
        children: [],
      };
      spans.set(id, span);
      if (parentId) {
        const parent = spans.get(parentId);
        if (parent) parent.children.push(span);
      }
      return span;
    },

    endSpan(spanId: string, status: "ok" | "error" = "ok") {
      const span = spans.get(spanId);
      if (span) {
        span.endTime = Date.now();
        span.status = status;
      }
    },

    record(event: TelemetryLifecycleEvent) {
      events.push(event);
      fanOut(event.phase, event.event).catch((e) => {
        log.warn(`[telemetry] fanOut error:`, e);
      });
    },

    getSpans() {
      return Array.from(spans.values());
    },

    getEvents() {
      return events;
    },

    getIntegrations() {
      return [...integrations];
    },
  };
}

export function registerTelemetry(manager: TelemetryManager, integration: TelemetryIntegration): void {
  manager.register(integration);
}

export class OpenTelemetryIntegration implements TelemetryIntegration {
  private tracer: { startSpan: (name: string) => { end: () => void; recordError: (err: unknown) => void } };

  constructor(tracer?: { startSpan: (name: string) => { end: () => void; recordError: (err: unknown) => void } }) {
    this.tracer = tracer ?? {
      startSpan: () => ({ end: () => {}, recordError: () => {} }),
    };
  }

  async onStart(event: TelemetryEvent): Promise<void> {
    const span = this.tracer.startSpan(`ai.generateText ${event.functionId ?? ""}`);
    span.end();
  }

  async onEnd(_event: TelemetryEvent): Promise<void> {}

  async onStepStart(_event: TelemetryEvent): Promise<void> {}

  async onStepEnd(_event: TelemetryEvent): Promise<void> {}

  async onLanguageModelCallStart(event: TelemetryEvent): Promise<void> {
    this.tracer.startSpan(`ai.languageModelCall ${event.modelId ?? ""}`);
  }

  async onLanguageModelCallEnd(_event: TelemetryEvent): Promise<void> {}

  async onToolExecutionStart(event: TelemetryEvent): Promise<void> {
    this.tracer.startSpan(`ai.toolCall ${event.functionId ?? ""}`);
  }

  async onToolExecutionEnd(_event: TelemetryEvent): Promise<void> {}

  async onAbort(_event: TelemetryEvent): Promise<void> {}
}

export class DevToolsTelemetryIntegration implements TelemetryIntegration {
  private runs: Array<{ id: string; startedAt: number; events: TelemetryLifecycleEvent[] }> = [];
  private currentRunId: string | null = null;

  async onStart(event: TelemetryEvent): Promise<void> {
    this.currentRunId = `run_${Date.now()}`;
    this.runs.push({ id: this.currentRunId, startedAt: Date.now(), events: [] });
  }

  async onEnd(_event: TelemetryEvent): Promise<void> {
    this.currentRunId = null;
  }

  async onStepStart(event: TelemetryEvent): Promise<void> {
    this.getCurrentRun()?.events.push({ phase: "onStepStart", event });
  }

  async onStepEnd(event: TelemetryEvent): Promise<void> {
    this.getCurrentRun()?.events.push({ phase: "onStepEnd", event });
  }

  async onLanguageModelCallStart(_event: TelemetryEvent): Promise<void> {}

  async onLanguageModelCallEnd(_event: TelemetryEvent): Promise<void> {}

  async onToolExecutionStart(_event: TelemetryEvent): Promise<void> {}

  async onToolExecutionEnd(_event: TelemetryEvent): Promise<void> {}

  async onAbort(_event: TelemetryEvent): Promise<void> {}

  getRuns() {
    return this.runs;
  }

  private getCurrentRun() {
    return this.runs.find((r) => r.id === this.currentRunId) ?? null;
  }
}
