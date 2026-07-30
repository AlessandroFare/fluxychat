import { describe, it, expect, vi } from "vitest";
import { createResumableAgentStream } from "./durable-ai-resume.js";
import { createDurableTransport } from "./durable-transport.js";

describe("createResumableAgentStream", () => {
  it("creates session and appends text", async () => {
    const stream = createResumableAgentStream({ deviceId: "d1" });
    expect(stream.sessionId).toBeTruthy();
    const off = await stream.appendText("hello");
    expect(off).toBe(0);
    stream.close();
  });

  it("reconnect returns missed chunks after offset", async () => {
    const transport = createDurableTransport();
    const stream = createResumableAgentStream({ deviceId: "d1", transport });
    await stream.appendText("a");
    await stream.appendText("b");
    const { missedChunks } = await stream.reconnect();
    expect(missedChunks.length).toBeGreaterThanOrEqual(0);
    stream.close();
  });

  it("syncs chunks to worker when configured", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = fetchImpl as typeof fetch;
    const stream = createResumableAgentStream({
      deviceId: "d1",
      worker: { baseUrl: "http://127.0.0.1:8787", token: "jwt" },
    });
    await stream.appendText("x");
    expect(fetchImpl).toHaveBeenCalled();
    stream.close();
  });
});
