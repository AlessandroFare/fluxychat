export interface ScriptedOutput {
  text: string;
  finishReason?: "stop" | "length" | "content_filter" | "tool_calls";
  usage?: { promptTokens: number; completionTokens: number };
  toolCalls?: Array<{
    toolName: string;
    args: Record<string, unknown>;
    id?: string;
  }>;
}

export interface ScriptedChunk {
  type: "text" | "tool_call" | "finish" | "error";
  textDelta?: string;
  toolCall?: {
    toolName: string;
    args: Record<string, unknown>;
    id?: string;
  };
  finishReason?: string;
  error?: string;
}

export interface DeterministicModelConfig {
  defaultOutput?: ScriptedOutput;
  outputs?: Record<string, ScriptedOutput>;
  chunks?: ScriptedChunk[];
  shouldThrow?: boolean;
  throwMessage?: string;
  latencyMs?: number;
}

export interface DeterministicLanguageModel {
  readonly modelId: string;
  readonly provider: string;
  generate(prompt: string, options?: { maxTokens?: number; temperature?: number }): Promise<ScriptedOutput>;
  stream(prompt: string, options?: { maxTokens?: number; temperature?: number }): AsyncIterable<ScriptedChunk>;
  configure(config: Partial<DeterministicModelConfig>): void;
  getCallHistory(): Array<{ prompt: string; timestamp: number; output?: ScriptedOutput }>;
  reset(): void;
}

export function createDeterministicLanguageModel(
  modelId = "deterministic-model",
  provider = "test",
  config?: DeterministicModelConfig,
): DeterministicLanguageModel {
  let outputs = config?.outputs ?? {};
  let defaultOutput = config?.defaultOutput ?? {
    text: "Hello from deterministic model",
    finishReason: "stop" as const,
    usage: { promptTokens: 10, completionTokens: 5 },
  };
  let chunks = config?.chunks ?? [
    { type: "text" as const, textDelta: "Hello " },
    { type: "text" as const, textDelta: "from " },
    { type: "text" as const, textDelta: "deterministic " },
    { type: "text" as const, textDelta: "model!" },
    { type: "finish" as const, finishReason: "stop" },
  ];
  let shouldThrow = config?.shouldThrow ?? false;
  let throwMessage = config?.throwMessage ?? "Model error";
  let latencyMs = config?.latencyMs ?? 0;
  const callHistory: Array<{ prompt: string; timestamp: number; output?: ScriptedOutput }> = [];

  function getOutputForPrompt(prompt: string): ScriptedOutput {
    if (outputs[prompt]) return outputs[prompt];
    return { ...defaultOutput };
  }

  async function applyLatency(): Promise<void> {
    if (latencyMs > 0) await new Promise((r) => setTimeout(r, latencyMs));
  }

  return {
    modelId,
    provider,

    async generate(prompt, options?) {
      if (shouldThrow) throw new Error(throwMessage);
      await applyLatency();
      const output = getOutputForPrompt(prompt);
      if (options?.maxTokens && output.usage) {
        output.usage.completionTokens = Math.min(output.usage.completionTokens, options.maxTokens);
      }
      callHistory.push({ prompt, timestamp: Date.now(), output });
      return output;
    },

    async *stream(prompt, options?) {
      if (shouldThrow) throw new Error(throwMessage);
      await applyLatency();
      const output = getOutputForPrompt(prompt);
      if (options?.maxTokens && output.usage) {
        output.usage.completionTokens = Math.min(output.usage.completionTokens, options.maxTokens);
      }
      callHistory.push({ prompt, timestamp: Date.now(), output });

      for (const chunk of chunks) {
        yield chunk;
      }
    },

    configure(config: Partial<DeterministicModelConfig>) {
      if (config.defaultOutput !== undefined) defaultOutput = config.defaultOutput;
      if (config.outputs !== undefined) outputs = config.outputs;
      if (config.chunks !== undefined) chunks = config.chunks;
      if (config.shouldThrow !== undefined) shouldThrow = config.shouldThrow;
      if (config.throwMessage !== undefined) throwMessage = config.throwMessage;
      if (config.latencyMs !== undefined) latencyMs = config.latencyMs;
    },

    getCallHistory() {
      return [...callHistory];
    },

    reset() {
      callHistory.length = 0;
    },
  };
}
