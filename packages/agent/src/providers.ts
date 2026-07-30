import type {
  AIFinishReason,
  AIProviderMetadata,
  AIStreamPart,
  AIUsage,
  AIWarning,
} from "./ai-core";
import type { AIReasoningConfig } from "./reasoning";

export const FLUXY_MODEL_SPEC_VERSION = "fluxy.ai.v1" as const;

export type AIModelModality =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "embedding"
  | "rerank"
  | "realtime";

export interface AIModelCapabilities {
  input: readonly AIModelModality[];
  output: readonly AIModelModality[];
  streaming?: boolean;
  tools?: boolean;
  structuredOutput?: boolean;
  reasoning?: boolean;
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

export type AIContentPart =
  | { type: "text"; text: string }
  | { type: "image"; image: string | Uint8Array; mediaType?: string }
  | { type: "audio"; audio: string | Uint8Array; mediaType?: string }
  | { type: "file"; data: string | Uint8Array; mediaType: string; filename?: string };

export type AIMessageRole = "system" | "user" | "assistant" | "tool";

export interface AIMessage {
  role: AIMessageRole;
  content: string | readonly AIContentPart[];
  name?: string;
  toolCallId?: string;
}

export interface AIToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  /** If true, the tool schema is defined by the provider (not user). */
  providerDefined?: boolean;
  /** If true, the tool executes on the provider's servers, not locally. */
  providerExecuted?: boolean;
}

export interface AIModelRequest {
  prompt: readonly AIMessage[];
  tools?: readonly AIToolDefinition[];
  responseFormat?:
    | { type: "text" }
    | { type: "json"; schema?: Record<string, unknown>; name?: string; description?: string };
  temperature?: number;
  maxOutputTokens?: number;
  stopSequences?: readonly string[];
  reasoning?: AIReasoningConfig;
  providerOptions?: Record<string, unknown>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface AIModelResponse {
  text: string;
  reasoningText?: string;
  finishReason: AIFinishReason;
  usage?: AIUsage;
  warnings?: readonly AIWarning[];
  providerMetadata?: AIProviderMetadata;
  rawResponse?: unknown;
}

export interface AILanguageModel {
  readonly specificationVersion: typeof FLUXY_MODEL_SPEC_VERSION;
  readonly provider: string;
  readonly modelId: string;
  readonly capabilities: AIModelCapabilities;
  generate(request: AIModelRequest): Promise<AIModelResponse>;
  stream?(request: AIModelRequest): Promise<ReadableStream<AIStreamPart>>;
}

export interface AIEmbeddingModel {
  readonly specificationVersion: typeof FLUXY_MODEL_SPEC_VERSION;
  readonly provider: string;
  readonly modelId: string;
  readonly dimensions?: number;
  embed(values: readonly string[], options?: { signal?: AbortSignal }): Promise<{
    embeddings: number[][];
    usage?: AIUsage;
    providerMetadata?: AIProviderMetadata;
  }>;
}

export interface AIRerankResult { index: number; score: number }
export interface AIRerankModel {
  readonly specificationVersion: typeof FLUXY_MODEL_SPEC_VERSION;
  readonly provider: string;
  readonly modelId: string;
  rerank(query: string, documents: readonly string[], options?: { topN?: number; signal?: AbortSignal }): Promise<{
    results: AIRerankResult[];
    usage?: AIUsage;
    providerMetadata?: AIProviderMetadata;
  }>;
}

export type AIModel = AILanguageModel | AIEmbeddingModel | AIRerankModel;
export type AIModelFactory = () => AIModel;

function modelKey(provider: string, modelId: string): string {
  const normalizedProvider = provider.trim();
  const normalizedModel = modelId.trim();
  if (!normalizedProvider || !normalizedModel) throw new Error("Provider and model id are required.");
  return `${normalizedProvider}:${normalizedModel}`;
}

export class AIProviderRegistry {
  readonly models = new Map<string, AIModelFactory>();
  private readonly aliases = new Map<string, string>();

  register(model: AIModel | AIModelFactory, options: { replace?: boolean; aliases?: readonly string[] } = {}): this {
    const resolved = typeof model === "function" ? model() : model;
    const key = modelKey(resolved.provider, resolved.modelId);
    if (!options.replace && this.models.has(key)) throw new Error(`AI model already registered: ${key}`);
    const factory = typeof model === "function" ? model : () => model;
    this.models.set(key, factory);
    for (const alias of options.aliases ?? []) this.alias(alias, key, { replace: options.replace });
    return this;
  }

  alias(alias: string, target: string, options: { replace?: boolean } = {}): this {
    const normalized = alias.trim();
    if (!normalized) throw new Error("Model alias is required.");
    if (!options.replace && (this.aliases.has(normalized) || this.models.has(normalized))) {
      throw new Error(`AI model alias already registered: ${normalized}`);
    }
    this.aliases.set(normalized, target.trim());
    return this;
  }

  resolve<T extends AIModel = AIModel>(reference: string): T {
    let key = reference.trim();
    const visited = new Set<string>();
    while (this.aliases.has(key)) {
      if (visited.has(key)) throw new Error(`Cyclic AI model alias: ${reference}`);
      visited.add(key);
      key = this.aliases.get(key) as string;
    }
    const factory = this.models.get(key);
    if (!factory) throw new Error(`Unknown AI model: ${reference}`);
    return factory() as T;
  }

  has(reference: string): boolean {
    try { this.resolve(reference); return true; } catch { return false; }
  }

  list(): string[] { return [...this.models.keys()].sort(); }
}

export class DeterministicLanguageModel implements AILanguageModel {
  readonly specificationVersion = FLUXY_MODEL_SPEC_VERSION;
  readonly provider = "fluxy-test";
  readonly modelId: string;
  readonly capabilities: AIModelCapabilities = {
    input: ["text"], output: ["text"], streaming: true, structuredOutput: true, reasoning: true,
  };

  constructor(
    private readonly response: string | ((request: AIModelRequest) => string),
    private readonly reasoningResponse?: string | ((request: AIModelRequest) => string),
    modelId = "deterministic",
  ) {
    this.modelId = modelId;
  }

  async generate(request: AIModelRequest): Promise<AIModelResponse> {
    if (request.signal?.aborted) throw request.signal.reason;
    const text = typeof this.response === "function" ? this.response(request) : this.response;
    const reasoningText = this.reasoningResponse
      ? typeof this.reasoningResponse === "function" ? this.reasoningResponse(request) : this.reasoningResponse
      : undefined;
    return {
      text,
      reasoningText,
      finishReason: "stop",
      usage: {
        inputTokens: request.prompt.length,
        outputTokens: text.length ? 1 : 0,
        ...(reasoningText ? { reasoningTokens: reasoningText.length } : {}),
      },
    };
  }

  async stream(request: AIModelRequest): Promise<ReadableStream<AIStreamPart>> {
    const result = await this.generate(request);
    return new ReadableStream<AIStreamPart>({
      start(controller) {
        controller.enqueue({ type: "start", modelId: "fluxy-test:deterministic" });
        if (result.reasoningText) {
          controller.enqueue({ type: "reasoning-start", id: "reasoning-0" });
          controller.enqueue({ type: "reasoning-delta", id: "reasoning-0", delta: result.reasoningText });
          controller.enqueue({ type: "reasoning-end", id: "reasoning-0" });
        }
        controller.enqueue({ type: "text-start", id: "text-0" });
        if (result.text) controller.enqueue({ type: "text-delta", id: "text-0", delta: result.text });
        controller.enqueue({ type: "text-end", id: "text-0" });
        controller.enqueue({ type: "finish", finishReason: result.finishReason, usage: result.usage });
        controller.close();
      },
    });
  }
}
