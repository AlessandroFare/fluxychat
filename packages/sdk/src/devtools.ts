export interface DevToolsRun {
  id: string;
  functionId?: string;
  startedAt: number;
  finishedAt?: number;
  steps: DevToolsStep[];
  parentRunId?: string;
}

export interface DevToolsStep {
  id: string;
  runId: string;
  stepNumber: number;
  type: "generateText" | "streamText" | "generateObject" | "streamObject";
  modelId?: string;
  provider?: string;
  startedAt: number;
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  toolCalls?: Array<{
    toolName: string;
    args: Record<string, unknown>;
    result?: unknown;
    durationMs?: number;
  }>;
  error?: string;
  rawRequest?: unknown;
  rawResponse?: unknown;
}

export interface DevToolsStore {
  getRuns(): DevToolsRun[];
  getRun(id: string): DevToolsRun | undefined;
  getSteps(runId: string): DevToolsStep[];
  addRun(run: DevToolsRun): void;
  addStep(step: DevToolsStep): void;
  updateRun(id: string, updates: Partial<DevToolsRun>): void;
  clear(): void;
}

export function createDevToolsStore(): DevToolsStore {
  const runs = new Map<string, DevToolsRun>();
  const steps = new Map<string, DevToolsStep>();

  return {
    getRuns() {
      return Array.from(runs.values());
    },

    getRun(id: string) {
      return runs.get(id);
    },

    getSteps(runId: string) {
      return Array.from(steps.values()).filter((s) => s.runId === runId);
    },

    addRun(run: DevToolsRun) {
      runs.set(run.id, { ...run, steps: [] });
    },

    addStep(step: DevToolsStep) {
      steps.set(step.id, step);
      const run = runs.get(step.runId);
      if (run) {
        run.steps = Array.from(steps.values())
          .filter((s) => s.runId === step.runId)
          .sort((a, b) => a.stepNumber - b.stepNumber);
      }
    },

    updateRun(id: string, updates: Partial<DevToolsRun>) {
      const run = runs.get(id);
      if (run) {
        Object.assign(run, updates);
      }
    },

    clear() {
      runs.clear();
      steps.clear();
    },
  };
}

export interface DevToolsInspector {
  getStore(): DevToolsStore;
  captureGenerateText(
    runId: string,
    stepNumber: number,
    params: { model?: string; provider?: string; input?: unknown; output?: unknown; usage?: DevToolsStep["usage"]; durationMs?: number },
  ): DevToolsStep;
  captureStreamText(
    runId: string,
    stepNumber: number,
    params: { model?: string; provider?: string; input?: unknown; output?: unknown; usage?: DevToolsStep["usage"]; durationMs?: number },
  ): DevToolsStep;
  captureToolCall(
    stepId: string,
    toolName: string,
    args: Record<string, unknown>,
    result?: unknown,
    durationMs?: number,
  ): void;
}

export function createDevToolsInspector(store?: DevToolsStore): DevToolsInspector {
  const db = store ?? createDevToolsStore();

  function makeStep(
    runId: string,
    stepNumber: number,
    type: DevToolsStep["type"],
    params: {
      model?: string;
      provider?: string;
      input?: unknown;
      output?: unknown;
      usage?: DevToolsStep["usage"];
      durationMs?: number;
    },
  ): DevToolsStep {
    const step: DevToolsStep = {
      id: `step_${runId}_${stepNumber}`,
      runId,
      stepNumber,
      type,
      modelId: params.model,
      provider: params.provider,
      startedAt: Date.now(),
      durationMs: params.durationMs,
      input: params.input,
      output: params.output,
      usage: params.usage,
    };
    db.addStep(step);
    return step;
  }

  return {
    getStore() {
      return db;
    },

    captureGenerateText(runId, stepNumber, params) {
      return makeStep(runId, stepNumber, "generateText", params);
    },

    captureStreamText(runId, stepNumber, params) {
      return makeStep(runId, stepNumber, "streamText", params);
    },

    captureToolCall(stepId, toolName, args, result, durationMs) {
      for (const step of db.getRuns().flatMap((r) => r.steps)) {
        if (step.id === stepId) {
          step.toolCalls = step.toolCalls ?? [];
          step.toolCalls.push({ toolName, args, result, durationMs });
          break;
        }
      }
    },
  };
}
