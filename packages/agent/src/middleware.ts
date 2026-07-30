import {
  FluxyAIError,
  type AIStreamPart,
  type AIGenerationResult,
  type AIFinishReason,
  type AIUsage,
} from "./ai-core";
import type { AILanguageModel, AIModelRequest, AIModelResponse } from "./providers";

export interface MiddlewareParams {
  params: AIModelRequest;
}

export interface GenerateContext {
  doGenerate: () => Promise<AIModelResponse>;
  params: AIModelRequest;
}

export interface StreamContext {
  doStream: () => Promise<ReadableStream<AIStreamPart>>;
  params: AIModelRequest;
}

export interface LanguageModelMiddleware {
  transformParams?: (context: MiddlewareParams) => AIModelRequest | Promise<AIModelRequest>;
  wrapGenerate?: (context: GenerateContext) => Promise<AIModelResponse>;
  wrapStream?: (context: StreamContext) => Promise<ReadableStream<AIStreamPart>>;
}

export interface WrappedModelOptions {
  model: AILanguageModel;
  middleware: LanguageModelMiddleware | readonly LanguageModelMiddleware[];
}

export function wrapLanguageModel(options: WrappedModelOptions): AILanguageModel {
  const middlewares = Array.isArray(options.middleware)
    ? options.middleware
    : [options.middleware];
  const inner = options.model;

  async function applyTransformParams(params: AIModelRequest, idx: number): Promise<AIModelRequest> {
    if (idx >= middlewares.length) return params;
    const mw = middlewares[idx];
    if (mw.transformParams) {
      return applyTransformParams(await mw.transformParams({ params }), idx + 1);
    }
    return applyTransformParams(params, idx + 1);
  }

  async function applyWrapGenerate(ctx: GenerateContext, idx: number): Promise<AIModelResponse> {
    if (idx >= middlewares.length) {
      return ctx.doGenerate();
    }
    const mw = middlewares[idx];
    if (mw.wrapGenerate) {
      return mw.wrapGenerate({
        doGenerate: () => applyWrapGenerate(ctx, idx + 1),
        params: ctx.params,
      });
    }
    return applyWrapGenerate(ctx, idx + 1);
  }

  async function applyWrapStream(ctx: StreamContext, idx: number): Promise<ReadableStream<AIStreamPart>> {
    if (idx >= middlewares.length) {
      return ctx.doStream();
    }
    const mw = middlewares[idx];
    if (mw.wrapStream) {
      return mw.wrapStream({
        doStream: () => applyWrapStream(ctx, idx + 1),
        params: ctx.params,
      });
    }
    return applyWrapStream(ctx, idx + 1);
  }

  return {
    specificationVersion: inner.specificationVersion,
    provider: inner.provider,
    modelId: inner.modelId,
    capabilities: { ...inner.capabilities },
    async generate(request: AIModelRequest): Promise<AIModelResponse> {
      const transformed = await applyTransformParams(request, 0);
      return applyWrapGenerate({
        doGenerate: () => inner.generate(transformed),
        params: transformed,
      }, 0);
    },
    async stream(request: AIModelRequest): Promise<ReadableStream<AIStreamPart>> {
      const transformed = await applyTransformParams(request, 0);
      if (!inner.stream) {
        const response = await applyWrapGenerate({
          doGenerate: () => inner.generate(transformed),
          params: transformed,
        }, 0);
        return simulateStreamFromResponse(response, transformed);
      }
      return applyWrapStream({
        doStream: () => inner.stream!(transformed),
        params: transformed,
      }, 0);
    },
  };
}

// ── Built-in middlewares ──

export interface ExtractReasoningMiddlewareOptions {
  tagName?: string;
  startWithReasoning?: boolean;
}

export function extractReasoningMiddleware(options?: ExtractReasoningMiddlewareOptions): LanguageModelMiddleware {
  const tagName = options?.tagName ?? "think";
  const startTag = `<${tagName}>`;
  const endTag = `</${tagName}>`;

  function extract(text: string): { reasoningText?: string; cleanText: string } {
    const regex = new RegExp(`${escapeRegex(startTag)}([\\s\\S]*?)${escapeRegex(endTag)}`, "g");
    const parts: string[] = [];
    let clean = text;
    let match: RegExpExecArray | null;
    const regexGlobal = new RegExp(regex.source, "g");
    while ((match = regexGlobal.exec(text)) !== null) {
      parts.push(match[1].trim());
    }
    if (parts.length > 0) {
      clean = text.replace(regex, "").trim();
    }
    return {
      reasoningText: parts.length > 0 ? parts.join("\n") : undefined,
      cleanText: clean,
    };
  }

  return {
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();
      const { reasoningText, cleanText } = extract(result.text);
      return { ...result, text: cleanText, reasoningText: reasoningText || result.reasoningText };
    },
    wrapStream: async ({ doStream }) => {
      const source = await doStream();
      let buffer = "";
      let reasoningBuffer = "";
      let inReasoning = false;
      let textId = "text-0";
      const startTagLen = startTag.length;
      const endTagLen = endTag.length;

      return new ReadableStream<AIStreamPart>({
        async start(controller) {
          const reader = source.getReader();
          try {
            for (;;) {
              const next = await reader.read();
              if (next.done) break;
              const part = next.value;
              if (part.type === "text-delta") {
                buffer += part.delta;
                textId = part.id;
                const startIdx = buffer.indexOf(startTag);
                const endIdx = buffer.indexOf(endTag);
                if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
                  const before = buffer.slice(0, startIdx);
                  const reasonContent = buffer.slice(startIdx + startTagLen, endIdx);
                  const after = buffer.slice(endIdx + endTagLen);
                  if (before) controller.enqueue({ type: "text-delta", id: textId, delta: before });
                  if (reasonContent) {
                    if (!reasoningBuffer) controller.enqueue({ type: "reasoning-start", id: "reasoning-0" });
                    controller.enqueue({ type: "reasoning-delta", id: "reasoning-0", delta: reasonContent });
                    controller.enqueue({ type: "reasoning-end", id: "reasoning-0" });
                    reasoningBuffer += reasonContent;
                  }
                  if (after) {
                    controller.enqueue({ type: "text-delta", id: textId, delta: after });
                    buffer = after;
                  } else {
                    buffer = "";
                  }
                  reasoningBuffer += reasonContent;
                } else if (startIdx !== -1 && endIdx === -1) {
                  const before = buffer.slice(0, startIdx);
                  const after = buffer.slice(startIdx + startTagLen);
                  if (before) controller.enqueue({ type: "text-delta", id: textId, delta: before });
                  buffer = after;
                  inReasoning = true;
                  if (!reasoningBuffer) controller.enqueue({ type: "reasoning-start", id: "reasoning-0" });
                } else if (endIdx !== -1 && startIdx === -1) {
                  const reasonContent = buffer.slice(0, endIdx);
                  const after = buffer.slice(endIdx + endTagLen);
                  if (reasonContent) {
                    controller.enqueue({ type: "reasoning-delta", id: "reasoning-0", delta: reasonContent });
                    reasoningBuffer += reasonContent;
                  }
                  controller.enqueue({ type: "reasoning-end", id: "reasoning-0" });
                  buffer = after;
                  inReasoning = false;
                } else if (inReasoning) {
                  controller.enqueue({ type: "reasoning-delta", id: "reasoning-0", delta: part.delta });
                  reasoningBuffer += part.delta;
                } else {
                  controller.enqueue(part);
                }
              } else {
                controller.enqueue(part);
              }
            }
            if (inReasoning) {
              controller.enqueue({ type: "reasoning-end", id: "reasoning-0" });
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          } finally {
            reader.releaseLock();
          }
        },
      });
    },
  };
}

export interface DefaultSettingsMiddlewareOptions {
  settings: Partial<AIModelRequest>;
}

export function defaultSettingsMiddleware(options: DefaultSettingsMiddlewareOptions): LanguageModelMiddleware {
  return {
    transformParams: async ({ params }) => {
      return {
        ...params,
        temperature: params.temperature ?? options.settings.temperature,
        maxOutputTokens: params.maxOutputTokens ?? options.settings.maxOutputTokens,
        stopSequences: params.stopSequences ?? options.settings.stopSequences,
        reasoning: params.reasoning ?? options.settings.reasoning,
        providerOptions: params.providerOptions ?? options.settings.providerOptions,
        headers: params.headers ?? options.settings.headers,
        responseFormat: params.responseFormat ?? options.settings.responseFormat,
        tools: params.tools ?? options.settings.tools,
      };
    },
  };
}

export function simulateStreamingMiddleware(): LanguageModelMiddleware {
  return {
    wrapGenerate: async ({ doGenerate }) => {
      return doGenerate();
    },
    wrapStream: async ({ doStream, params }) => {
      const response = await doStream();
      return response;
    },
  };
}

export function simulateStreamingFromGenerate(
  model: AILanguageModel,
): AILanguageModel {
  return {
    ...model,
    async stream(request: AIModelRequest): Promise<ReadableStream<AIStreamPart>> {
      const response = await model.generate(request);
      return simulateStreamFromResponse(response, request);
    },
  };
}

function simulateStreamFromResponse(response: AIModelResponse, _params: AIModelRequest): ReadableStream<AIStreamPart> {
  const text = response.text;
  const reasoningText = response.reasoningText;
  const finishReason: AIFinishReason = response.finishReason;
  const usage: AIUsage = response.usage ?? {};

  const CHUNK_SIZE = 1;
  const textChars: string[] = [];
  const reasoningChars: string[] = [];
  if (text) {
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
      textChars.push(text.slice(i, i + CHUNK_SIZE));
    }
  }
  if (reasoningText) {
    for (let i = 0; i < reasoningText.length; i += CHUNK_SIZE) {
      reasoningChars.push(reasoningText.slice(i, i + CHUNK_SIZE));
    }
  }

  return new ReadableStream<AIStreamPart>({
    async start(controller) {
      controller.enqueue({ type: "start", modelId: "simulated" });
      if (reasoningChars.length > 0) {
        controller.enqueue({ type: "reasoning-start", id: "reasoning-0" });
        for (const chunk of reasoningChars) {
          controller.enqueue({ type: "reasoning-delta", id: "reasoning-0", delta: chunk });
        }
        controller.enqueue({ type: "reasoning-end", id: "reasoning-0" });
      }
      controller.enqueue({ type: "text-start", id: "text-0" });
      for (const chunk of textChars) {
        controller.enqueue({ type: "text-delta", id: "text-0", delta: chunk });
      }
      controller.enqueue({ type: "text-end", id: "text-0" });
      controller.enqueue({ type: "finish", finishReason, usage });
      controller.close();
    },
  });
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractJsonMiddleware(options?: { transform?: (text: string) => string }): LanguageModelMiddleware {
  return {
    wrapGenerate: async ({ doGenerate }) => {
      const result = await doGenerate();
      const cleaned = options?.transform
        ? options.transform(result.text)
        : stripMarkdownFence(result.text);
      return { ...result, text: cleaned };
    },
    wrapStream: async ({ doStream }) => {
      const source = await doStream();
      let buffer = "";
      return new ReadableStream<AIStreamPart>({
        async start(controller) {
          const reader = source.getReader();
          try {
            for (;;) {
              const next = await reader.read();
              if (next.done) break;
              const part = next.value;
              if (part.type === "text-delta") {
                buffer += part.delta;
                const cleaned = options?.transform
                  ? options.transform(buffer)
                  : stripMarkdownFence(buffer);
                controller.enqueue({ type: "text-delta", id: part.id, delta: cleaned.slice(0, cleaned.length - buffer.length + part.delta.length) });
              } else if (part.type === "finish") {
                const finalCleaned = options?.transform
                  ? options.transform(buffer)
                  : stripMarkdownFence(buffer);
                controller.enqueue({ type: "text-delta", id: "text-0", delta: finalCleaned.slice(buffer.length) });
                controller.enqueue(part);
              } else {
                controller.enqueue(part);
              }
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          } finally {
            reader.releaseLock();
          }
        },
      });
    },
  };
}

function stripMarkdownFence(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "").trim();
}
