import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHTTPTransport,
  createSSETransport,
  createTransportRegistry,
} from "./transport";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetch transports", () => {
  it("sends authenticated JSON and parses a JSON response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const transport = createHTTPTransport({ type: "http", baseUrl: "https://example.test/api", apiKey: "secret" });
    const response = await transport.send({ method: "POST", path: "runs", body: { prompt: "hello" } });
    expect(response.body).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer secret");
    expect(init.body).toBe(JSON.stringify({ prompt: "hello" }));
  });

  it("decodes SSE across chunk boundaries without corrupting UTF-8", async () => {
    const bytes = new TextEncoder().encode("data: {\"text\":\"ciao €\"}\n\ndata: done\n\n");
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 20));
        controller.enqueue(bytes.slice(20));
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, {
      headers: { "content-type": "text/event-stream" },
    })));
    const transport = createSSETransport({ type: "sse", baseUrl: "https://example.test" });
    const parts: unknown[] = [];
    for await (const part of transport.stream({ method: "GET", path: "/events" })) parts.push(part);
    expect(parts).toEqual([{ text: "ciao €" }, "done"]);
  });
});

describe("transport registry", () => {
  it("selects the first healthy preferred transport and closes all", async () => {
    const registry = createTransportRegistry();
    const unhealthy = { type: "http" as const, send: vi.fn(), stream: vi.fn(), healthCheck: vi.fn().mockResolvedValue(false), close: vi.fn() };
    const healthy = { type: "sse" as const, send: vi.fn(), stream: vi.fn(), healthCheck: vi.fn().mockResolvedValue(true), close: vi.fn() };
    registry.register("primary", unhealthy);
    registry.register("fallback", healthy);
    expect(await registry.selectHealthy(["primary", "fallback"])).toBe(healthy);
    expect(registry.list()).toEqual([
      { name: "primary", type: "http", healthy: false },
      { name: "fallback", type: "sse", healthy: true },
    ]);
    await registry.close();
    expect(unhealthy.close).toHaveBeenCalledOnce();
    expect(healthy.close).toHaveBeenCalledOnce();
  });
});
