import { afterEach, describe, it, expect, vi } from "vitest";
import { createKbSource, listKbDocFeedback, searchKbDocuments, setKbDocFeedback } from "./kb-connectors.js";

function kvEnv(extra = {}) {
  const store = new Map();
  return {
    RATE_LIMIT_KV: {
      get: async (key) => store.get(key) ?? null,
      put: async (key, value) => {
        store.set(key, value);
      },
    },
    ALLOWED_SSRF_HOSTS: "example.com",
    ...extra,
  };
}

function dbEnv({ articles = [], feedback = [], failFeedback = false } = {}) {
  const runs = [];
  return {
    runs,
    env: {
      RATE_LIMIT_KV: null,
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async all() {
                  if (sql.includes("kb_doc_feedback")) {
                    if (failFeedback) throw new Error("no such table: kb_doc_feedback");
                    return { results: feedback };
                  }
                  if (sql.includes("FROM support_knowledge_base")) return { results: articles };
                  return { results: [] };
                },
                async run() {
                  runs.push({ sql, args });
                  return { success: true, meta: { last_row_id: 1 } };
                },
              };
            },
          };
        },
      },
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("kb-connectors", () => {
  it("rejects invalid source type", async () => {
    const env = { RATE_LIMIT_KV: null };
    const result = await createKbSource(env, { projectId: "p1", type: "invalid", name: "X" });
    expect(result.error).toBe("invalid_type");
  });

  it("requires name", async () => {
    const env = { RATE_LIMIT_KV: null };
    const result = await createKbSource(env, { projectId: "p1", type: "url", name: "  " });
    expect(result.error).toBe("name_required");
  });

  it("probes a URL source on creation and records the result", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok", { status: 200 })));
    const result = await createKbSource(kvEnv(), {
      projectId: "p1",
      type: "url",
      name: "Handbook",
      config: { url: "https://example.com/handbook" },
    });
    expect(result.source.verification).toMatchObject({ ok: true, status: 200 });
    expect(Date.parse(result.source.verification.checkedAt)).toBeGreaterThan(0);
  });

  it("records a blocked probe instead of failing the save", async () => {
    const result = await createKbSource(kvEnv(), {
      projectId: "p1",
      type: "url",
      name: "Internal",
      config: { url: "http://127.0.0.1/secret" },
    });
    expect(result.source.id).toBeTruthy();
    expect(result.source.verification.ok).toBe(false);
    expect(String(result.source.verification.error)).toBeTruthy();
  });

  it("validates and records per-document feedback", async () => {
    const { env, runs } = dbEnv();
    expect((await setKbDocFeedback(env, { projectId: "p1", docId: "", verdict: "boost" })).error).toBe(
      "docId_required",
    );
    expect((await setKbDocFeedback(env, { projectId: "p1", docId: "d1", verdict: "nuke" })).error).toBe(
      "invalid_verdict",
    );

    const saved = await setKbDocFeedback(env, { projectId: "p1", docId: " d1 ", verdict: "hide", actor: "u1" });
    expect(saved.ok).toBe(true);
    expect(runs[0].sql).toContain("ON CONFLICT(project_id, doc_id) DO UPDATE");
    expect(runs[0].args.slice(0, 3)).toEqual(["p1", "d1", "hide"]);

    const cleared = await setKbDocFeedback(env, { projectId: "p1", docId: "d1", verdict: "clear" });
    expect(cleared.cleared).toBe(true);
    expect(runs[1].sql).toContain("DELETE FROM kb_doc_feedback");
  });

  it("applies boost/hide feedback to knowledge search hits", async () => {
    const { env } = dbEnv({
      articles: [
        { id: "a1", title: "Alpha", content: "first", tags: null, updated_at: "2026-08-03T00:00:00.000Z" },
        { id: "a2", title: "Beta", content: "second", tags: null, updated_at: "2026-08-02T00:00:00.000Z" },
        { id: "a3", title: "Gamma", content: "third", tags: null, updated_at: "2026-08-01T00:00:00.000Z" },
      ],
      feedback: [
        { doc_id: "a1", verdict: "hide" },
        { doc_id: "a3", verdict: "boost" },
      ],
    });
    const hits = await searchKbDocuments(env, { projectId: "p1", query: "a" });
    expect(hits.map((h) => h.id)).toEqual(["a3", "a2"]);
  });

  it("keeps searching when the 0261 feedback table is absent", async () => {
    const { env } = dbEnv({
      articles: [{ id: "a1", title: "Alpha", content: "first", tags: null, updated_at: "2026-08-03T00:00:00.000Z" }],
      failFeedback: true,
    });
    expect(await listKbDocFeedback(env, { projectId: "p1" })).toEqual([]);
    const hits = await searchKbDocuments(env, { projectId: "p1", query: "a" });
    expect(hits.map((h) => h.id)).toEqual(["a1"]);
  });
});
