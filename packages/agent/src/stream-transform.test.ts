import { describe, it, expect } from "vitest";
import { smoothStream, experimental_transform } from "./stream-transform";
import type { AIStreamPart } from "./ai-core";

function makeStream(parts: AIStreamPart[]): ReadableStream<AIStreamPart> {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(part);
      }
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<AIStreamPart>): Promise<AIStreamPart[]> {
  const reader = stream.getReader();
  const parts: AIStreamPart[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }
  return parts;
}

describe("smoothStream", () => {
  it("adds delay between text chunks", async () => {
    const input = makeStream([
      { type: "text-start", id: "text-0" },
      { type: "text-delta", id: "text-0", delta: "abc" },
      { type: "text-end", id: "text-0" },
      { type: "finish", finishReason: "stop", usage: {} },
    ]);
    const start = Date.now();
    const output = input.pipeThrough(smoothStream({ delayInMs: 10, chunkSize: 1 }));
    const parts = await collect(output);
    const elapsed = Date.now() - start;
    expect(parts.length).toBeGreaterThan(3);
    const textParts = parts.filter((p) => p.type === "text-delta");
    expect(textParts.length).toBe(3);
    expect(elapsed).toBeGreaterThanOrEqual(10);
  });

  it("non-text parts pass through unchanged", async () => {
    const input = makeStream([
      { type: "start", modelId: "test" },
      { type: "text-start", id: "text-0" },
      { type: "text-end", id: "text-0" },
      { type: "finish", finishReason: "stop", usage: {} },
    ]);
    const output = input.pipeThrough(smoothStream({ delayInMs: 1 }));
    const parts = await collect(output);
    expect(parts.find((p) => p.type === "start")).toBeDefined();
    expect(parts.find((p) => p.type === "text-start")).toBeDefined();
    expect(parts.find((p) => p.type === "finish")).toBeDefined();
  });
});

describe("experimental_transform", () => {
  it("transforms parts with custom function", async () => {
    const input = makeStream([
      { type: "text-delta", id: "text-0", delta: "hello" },
      { type: "text-delta", id: "text-0", delta: " world" },
    ]);
    const output = input.pipeThrough(
      experimental_transform({
        transform: (part) => {
          if (part.type === "text-delta") {
            return { ...part, delta: part.delta.toUpperCase() };
          }
          return part;
        },
      }),
    );
    const parts = await collect(output);
    expect(parts).toHaveLength(2);
    expect((parts[0] as any).delta).toBe("HELLO");
    expect((parts[1] as any).delta).toBe(" WORLD");
  });

  it("returns null to skip parts", async () => {
    const input = makeStream([
      { type: "text-start", id: "text-0" },
      { type: "text-delta", id: "text-0", delta: "visible" },
      { type: "text-end", id: "text-0" },
    ]);
    const output = input.pipeThrough(
      experimental_transform({
        transform: (part) => part.type === "text-start" ? null : part,
      }),
    );
    const parts = await collect(output);
    expect(parts.find((p) => p.type === "text-start")).toBeUndefined();
    expect(parts.find((p) => p.type === "text-delta")).toBeDefined();
  });

  it("returns multiple parts from a single input", async () => {
    const input = makeStream([
      { type: "text-delta", id: "text-0", delta: "a" },
    ]);
    const output = input.pipeThrough(
      experimental_transform({
        transform: () => [
          { type: "text-delta" as const, id: "text-0", delta: "x" },
          { type: "text-delta" as const, id: "text-0", delta: "y" },
        ],
      }),
    );
    const parts = await collect(output);
    expect(parts).toHaveLength(2);
  });
});
