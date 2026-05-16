import { describe, expect, it, vi, afterEach } from "vitest";
import {
  fetchWorkerJson,
  parseWorkerJson,
  WORKER_TRACE_HEADER,
} from "./worker-fetch";

describe("parseWorkerJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws worker error message on non-OK JSON", async () => {
    const res = new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
    await expect(parseWorkerJson(res)).rejects.toThrow("forbidden");
  });

  it("appends X-Trace-Id to thrown errors for support", async () => {
    const res = new Response(JSON.stringify({ error: "quota_exceeded" }), {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        [WORKER_TRACE_HEADER]: "trace-abc-123",
      },
    });
    await expect(parseWorkerJson(res)).rejects.toThrow(
      "quota_exceeded (trace: trace-abc-123)"
    );
  });

  it("uses traceId from JSON body when header is absent", async () => {
    const res = new Response(
      JSON.stringify({ error: "forbidden", traceId: "trace-body-99" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
    await expect(parseWorkerJson(res)).rejects.toThrow(
      "forbidden (trace: trace-body-99)"
    );
  });

  it("returns parsed body on success", async () => {
    const res = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const data = await parseWorkerJson<{ ok: boolean }>(res);
    expect(data.ok).toBe(true);
  });
});

describe("fetchWorkerJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("delegates to fetch and parseWorkerJson", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ projects: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    const data = await fetchWorkerJson<{ projects: unknown[] }>("https://worker.test/admin/projects");
    expect(data.projects).toEqual([]);
  });
});
