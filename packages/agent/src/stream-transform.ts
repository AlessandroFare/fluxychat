import type { AIStreamPart } from "./ai-core";

export interface SmoothStreamOptions {
  delayInMs?: number;
  chunkSize?: number;
  wordDelay?: boolean;
}

export function smoothStream(options?: SmoothStreamOptions): TransformStream<AIStreamPart, AIStreamPart> {
  const delayInMs = options?.delayInMs ?? 50;
  const chunkSize = options?.chunkSize ?? 1;
  const wordDelay = options?.wordDelay ?? false;

  return new TransformStream<AIStreamPart, AIStreamPart>({
    async transform(part, controller) {
      if (part.type === "text-delta" && part.delta) {
        const chars = part.delta;
        if (wordDelay) {
          const words = splitIntoWords(chars);
          for (const word of words) {
            controller.enqueue({ type: "text-delta", id: part.id, delta: word });
            await sleep(delayInMs);
          }
        } else {
          for (let i = 0; i < chars.length; i += chunkSize) {
            controller.enqueue({ type: "text-delta", id: part.id, delta: chars.slice(i, i + chunkSize) });
            await sleep(delayInMs);
          }
        }
      } else {
        controller.enqueue(part);
      }
    },
  });
}

export type StreamTransformFunction = (part: AIStreamPart) => AIStreamPart | AIStreamPart[] | null | Promise<AIStreamPart | AIStreamPart[] | null>;

export interface ExperimentalTransformOptions {
  transform: StreamTransformFunction;
}

export function experimental_transform(options: ExperimentalTransformOptions): TransformStream<AIStreamPart, AIStreamPart> {
  return new TransformStream<AIStreamPart, AIStreamPart>({
    async transform(part, controller) {
      const result = await options.transform(part);
      if (result === null) return;
      if (Array.isArray(result)) {
        for (const p of result) {
          controller.enqueue(p);
        }
      } else {
        controller.enqueue(result);
      }
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitIntoWords(text: string): string[] {
  const words: string[] = [];
  let current = "";
  for (const char of text) {
    current += char;
    if (char === " " || char === "\n" || char === "\t") {
      words.push(current);
      current = "";
    }
  }
  if (current) words.push(current);
  return words.length > 0 ? words : [text];
}
