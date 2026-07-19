import type { AIStreamPart } from "./ai-core";

export interface AITextStreamOptions {
  includeReasoning?: boolean;
  onPart?: (part: AIStreamPart) => void | Promise<void>;
}

/** Convert canonical parts to a standalone text stream without consuming a generation result. */
export function toTextStream(
  source: ReadableStream<AIStreamPart>,
  options: AITextStreamOptions = {},
): ReadableStream<string> {
  const reader = source.getReader();
  return new ReadableStream<string>({
    async pull(controller) {
      try {
        for (;;) {
          const next = await reader.read();
          if (next.done) {
            controller.close();
            reader.releaseLock();
            return;
          }
          await options.onPart?.(next.value);
          if (next.value.type === "text-delta") {
            controller.enqueue(next.value.delta);
            return;
          }
          if (options.includeReasoning && next.value.type === "reasoning-delta") {
            controller.enqueue(next.value.delta);
            return;
          }
          if (next.value.type === "error") throw new Error(next.value.error.message);
        }
      } catch (error) {
        controller.error(error);
        reader.releaseLock();
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
      reader.releaseLock();
    },
  });
}

export async function collectTextStream(source: ReadableStream<string>): Promise<string> {
  const reader = source.getReader();
  let text = "";
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) return text;
      text += next.value;
    }
  } finally {
    reader.releaseLock();
  }
}

/** Extract reasoning text from a stream, returning both text and reasoning. */
export async function collectStreamParts(
  source: ReadableStream<AIStreamPart>,
): Promise<{ text: string; reasoningText: string; parts: AIStreamPart[] }> {
  const reader = source.getReader();
  const parts: AIStreamPart[] = [];
  let text = "";
  let reasoningText = "";
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      parts.push(next.value);
      if (next.value.type === "text-delta") text += next.value.delta;
      if (next.value.type === "reasoning-delta") reasoningText += next.value.delta;
    }
  } finally {
    reader.releaseLock();
  }
  return { text, reasoningText, parts };
}
