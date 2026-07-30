import { FluxyAIError, addUsage, type AIStreamPart, type AIGenerationResult, type AIFinishReason, type AIUsage, type AIProviderMetadata } from "./ai-core";
import type { AITool, AgentStopCondition, AgentLoopState, AIToolResult } from "./agent-loop";
import type { ToolApprovalConfig } from "./tool-approval";

export interface HarnessSession {
  readonly id: string;
  destroy(): Promise<void>;
  detach(): Promise<HarnessSessionResumeState>;
}

export interface HarnessSessionResumeState {
  sessionId: string;
  state: unknown;
  createdAt: number;
}

export interface HarnessGenerateOptions {
  prompt: string;
  system?: string;
  tools?: Record<string, AITool>;
  maxSteps?: number;
  signal?: AbortSignal;
  session?: HarnessSession;
}

export interface HarnessStreamOptions extends HarnessGenerateOptions {
  onChunk?: (part: AIStreamPart) => void;
}

export interface HarnessGenerateResult {
  text: string;
  reasoningText?: string;
  finishReason: AIFinishReason;
  usage: AIUsage;
  steps: readonly HarnessStepResult[];
  responseMessages: readonly HarnessMessage[];
}

export interface HarnessStreamResult {
  stream: ReadableStream<AIStreamPart>;
  result: Promise<HarnessGenerateResult>;
  text: Promise<string>;
}

export interface HarnessStepResult {
  text: string;
  finishReason: AIFinishReason;
  usage: AIUsage;
}

export interface HarnessMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface HarnessAdapter {
  readonly name: string;
  createSession(sandbox?: unknown): Promise<HarnessSession>;
  generate(options: {
    prompt: string;
    system?: string;
    tools?: Record<string, AITool>;
    maxSteps?: number;
    signal?: AbortSignal;
    session?: HarnessSession;
  }): Promise<HarnessGenerateResult>;
  stream(options: {
    prompt: string;
    system?: string;
    tools?: Record<string, AITool>;
    maxSteps?: number;
    signal?: AbortSignal;
    session?: HarnessSession;
  }): Promise<HarnessStreamResult>;
}

export class HarnessAgent {
  readonly adapter: HarnessAdapter;

  constructor(adapter: HarnessAdapter) {
    this.adapter = adapter;
  }

  async createSession(sandbox?: unknown): Promise<HarnessSession> {
    return this.adapter.createSession(sandbox);
  }

  async generate(options: HarnessGenerateOptions): Promise<HarnessGenerateResult> {
    return this.adapter.generate(options);
  }

  stream(options: HarnessStreamOptions): HarnessStreamResult {
    const adapter = this.adapter;
    const controller = new AbortController();
    const abortFromParent = () => controller.abort(options.signal?.reason);
    if (options.signal?.aborted) abortFromParent();
    else options.signal?.addEventListener("abort", abortFromParent, { once: true });

    let resolveResult!: (result: HarnessGenerateResult) => void;
    let rejectResult!: (reason: unknown) => void;
    const result = new Promise<HarnessGenerateResult>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    void result.catch(() => undefined);

    const output = new ReadableStream<AIStreamPart>({
      async start(target) {
        try {
          const harnessResult = await adapter.generate({ ...options, signal: controller.signal });
          const modelId = `harness:${adapter.name}`;

          target.enqueue({ type: "start", modelId });
          if (harnessResult.reasoningText) {
            target.enqueue({ type: "reasoning-start", id: "reasoning-0" });
            target.enqueue({ type: "reasoning-delta", id: "reasoning-0", delta: harnessResult.reasoningText });
            target.enqueue({ type: "reasoning-end", id: "reasoning-0" });
          }
          target.enqueue({ type: "text-start", id: "text-0" });
          if (harnessResult.text) target.enqueue({ type: "text-delta", id: "text-0", delta: harnessResult.text });
          target.enqueue({ type: "text-end", id: "text-0" });
          target.enqueue({ type: "finish", finishReason: harnessResult.finishReason, usage: harnessResult.usage });

          resolveResult(harnessResult);
          target.close();
        } catch (error) {
          const classified = error instanceof FluxyAIError ? error
            : new FluxyAIError({ code: "provider_error", message: error instanceof Error ? error.message : "Harness execution failed", retryable: false, cause: error });
          rejectResult(classified);
          target.error(classified);
        } finally {
          options.signal?.removeEventListener("abort", abortFromParent);
        }
      },
      cancel(reason) { controller.abort(reason); },
    });

    return { stream: output, result, text: result.then((r) => r.text) };
  }
}
