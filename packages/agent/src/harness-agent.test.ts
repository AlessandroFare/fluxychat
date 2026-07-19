import { describe, it, expect } from "vitest";
import { HarnessAgent, type HarnessAdapter, type HarnessSession } from "./harness-agent";

describe("HarnessAgent", () => {
  const mockAdapter: HarnessAdapter = {
    name: "test-harness",
    async createSession() {
      return {
        id: "session_1",
        async destroy() {},
        async detach() {
          return { sessionId: "session_1", state: null, createdAt: Date.now() };
        },
      };
    },
    async generate(opts) {
      return {
        text: `Response to: ${opts.prompt}`,
        reasoningText: undefined,
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 5 },
        steps: [{ text: `Response to: ${opts.prompt}`, finishReason: "stop", usage: { inputTokens: 10, outputTokens: 5 } }],
        responseMessages: [{ role: "assistant", content: `Response to: ${opts.prompt}` }],
      };
    },
    async stream(opts) {
      const result = await this.generate(opts);
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "start", modelId: "test-harness" } as any);
            controller.enqueue({ type: "text-start", id: "text-0" } as any);
            controller.enqueue({ type: "text-delta", id: "text-0", delta: result.text } as any);
            controller.enqueue({ type: "text-end", id: "text-0" } as any);
            controller.enqueue({ type: "finish", finishReason: "stop", usage: result.usage } as any);
            controller.close();
          },
        }),
        result: Promise.resolve(result),
        text: Promise.resolve(result.text),
      };
    },
  };

  it("forwards generate call to adapter", async () => {
    const agent = new HarnessAgent(mockAdapter);
    const result = await agent.generate({ prompt: "Hello" });
    expect(result.text).toBe("Response to: Hello");
    expect(result.finishReason).toBe("stop");
    expect(result.usage.inputTokens).toBe(10);
  });

  it("forwards createSession to adapter", async () => {
    const agent = new HarnessAgent(mockAdapter);
    const session = await agent.createSession();
    expect(session.id).toBe("session_1");
  });

  it("stream returns streamable result", async () => {
    const agent = new HarnessAgent(mockAdapter);
    const sr = agent.stream({ prompt: "Test" });
    const text = await sr.text;
    expect(text).toBe("Response to: Test");
    const result = await sr.result;
    expect(result.finishReason).toBe("stop");
  });

  it("stream produces stream parts", async () => {
    const agent = new HarnessAgent(mockAdapter);
    const sr = agent.stream({ prompt: "Test" });
    const reader = sr.stream.getReader();
    const parts: any[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
    }
    expect(parts.length).toBeGreaterThanOrEqual(4);
    expect(parts.find((p) => p.type === "start")).toBeDefined();
    expect(parts.find((p) => p.type === "text-delta")).toBeDefined();
    expect(parts.find((p) => p.type === "finish")).toBeDefined();
  });

  it("handles generate errors", async () => {
    const errorAdapter: HarnessAdapter = {
      ...mockAdapter,
      async generate() {
        throw new Error("Harness failure");
      },
    };
    const agent = new HarnessAgent(errorAdapter);
    await expect(agent.generate({ prompt: "x" })).rejects.toThrow("Harness failure");
  });
});
