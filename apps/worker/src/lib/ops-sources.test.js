import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryOpsStore } from "./ops-store.js";
import { defaultOpsPolicy } from "./ops-policy.js";
import { applyDocFeedback, normalizeSearchHits } from "./ops-search-hits.js";
import { describeOpsSources, executeOpsTool, ingestOpsFile, queryNamedView, searchOpsFiles } from "./ops-sources.js";
import { encryptSecret } from "./secrets-crypto.js";

describe("ops search hits", () => {
  it("maps AI Search chunks and legacy data to citations", () => {
    const modern = normalizeSearchHits(
      { chunks: [{ id: "a", content: "hello", score: 0.9, filename: "a.txt" }] },
      { backend: "ai_search" },
    );
    expect(modern.citations[0].sourceId).toBe("a");
    expect(modern.citations[0].title).toBe("a.txt");
    const legacy = normalizeSearchHits({ data: [{ id: "b", text: "old" }] }, { backend: "ai_search" });
    expect(legacy.chunks[0].content).toBe("old");
  });

  it("applies boost/hide document feedback at normalization", () => {
    const hits = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const ranked = applyDocFeedback(hits, new Map([["a", "hide"], ["c", "boost"]]));
    expect(ranked.map((h) => h.id)).toEqual(["c", "b"]);
    expect(applyDocFeedback(hits, new Map())).toEqual(hits);
  });
});

describe("searchOpsFiles", () => {
  it("uses chunks from the bound search API", async () => {
    const store = createMemoryOpsStore();
    const packed = await searchOpsFiles(
      {
        OPS_AI_SEARCH: {
          search: async () => ({ chunks: [{ id: "f1", content: "policy", score: 0.8, filename: "p.md" }] }),
        },
      },
      store,
      { projectId: "p1", query: "policy" },
    );
    expect(packed.backend).toBe("ai_search");
    expect(packed.citations).toHaveLength(1);
  });

  it("falls back to D1 file scan", async () => {
    const store = createMemoryOpsStore();
    await store.putFile("p1", { sourceId: "files", key: "note.txt", text: "vacation policy", contentType: "text/plain" });
    const packed = await searchOpsFiles({}, store, { projectId: "p1", query: "vacation" });
    expect(packed.backend).toBe("d1_scan");
    expect(packed.chunks.length).toBeGreaterThan(0);
    expect(packed.citations[0].title).toBe("note.txt");
  });
});

describe("queryNamedView", () => {
  it("rejects unknown filter columns", async () => {
    const store = createMemoryOpsStore();
    const denied = await queryNamedView(store, defaultOpsPolicy(), {
      view: "orders",
      filters: { drop_table: "1" },
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toBe("view_filter_unknown_column");
    expect(denied.allowedColumns).toContain("invoiceNumber");
  });

  it("names the allowed views when the view is not allowed", async () => {
    const store = createMemoryOpsStore();
    const denied = await queryNamedView(store, defaultOpsPolicy(), {
      view: "secrets",
      filters: {},
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toBe("view_not_allowed");
    expect(denied.allowedViews).toContain("orders");
  });

  it("returns mdl metadata without executable SQL", async () => {
    const store = createMemoryOpsStore();
    store.setNamedViewRows("orders", [{ id: "1", invoiceNumber: "INV-1", supplier: "acme" }]);
    const found = await queryNamedView(store, defaultOpsPolicy(), {
      view: "orders",
      filters: { invoiceNumber: "INV-1" },
    });
    expect(found.ok).toBe(true);
    expect(found.query).toBeNull();
    expect(found.mdl.columns).toContain("invoiceNumber");
    expect(found.rowCount).toBe(1);
  });
});

describe("ingest and OCR", () => {
  it("writes to ATTACHMENTS when OPS_R2 is absent", async () => {
    const store = createMemoryOpsStore();
    const put = [];
    const file = await ingestOpsFile(
      { ATTACHMENTS: { put: async (key) => put.push(key) } },
      store,
      { projectId: "p1", key: "a.txt", text: "hi" },
    );
    expect(file.id).toBeTruthy();
    expect(put[0]).toContain(file.id);
  });

  it("uses Workers AI toMarkdown when the file has no stored text", async () => {
    const store = createMemoryOpsStore();
    const file = await store.putFile("p1", { sourceId: "files", key: "scan.pdf", text: "", contentType: "application/pdf" });
    const result = await executeOpsTool(
      store,
      defaultOpsPolicy(),
      { AI: { toMarkdown: async () => [{ markdown: "Invoice 12" }] } },
      "ocr.read",
      { fileId: file.id, bytes: new Uint8Array([1, 2]) },
      { projectId: "p1" },
    );
    expect(result.data.documentText).toContain("Invoice 12");
    expect(result.data.ocrBackend).toBe("workers_ai_tomarkdown");
  });

  it("describes unbound search as fallback", () => {
    const desc = describeOpsSources({}, defaultOpsPolicy());
    expect(desc.aiSearch).toBe(false);
    expect(desc.namedViews.some((v) => v.name === "orders")).toBe(true);
  });
});

describe("executeOpsTool files.search", () => {
  it("wraps hits as ok data with citations", async () => {
    const store = createMemoryOpsStore();
    await store.putFile("p1", { sourceId: "files", key: "a.txt", text: "alpha", contentType: "text/plain" });
    const result = await executeOpsTool(store, defaultOpsPolicy(), {}, "files.search", { query: "alpha" }, { projectId: "p1" });
    expect(result.ok).toBe(true);
    expect(result.citations.length).toBeGreaterThan(0);
  });
});

describe("executeOpsTool notify.send", () => {
  function notifyEnv(roomMembers = []) {
    const inserts = [];
    return {
      inserts,
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                async first() {
                  return null;
                },
                async run() {
                  inserts.push(sql);
                  return { meta: { changes: 1, last_row_id: inserts.length } };
                },
                async all() {
                  return { results: sql.includes("room_members") ? roomMembers : [] };
                },
              };
            },
          };
        },
      },
    };
  }

  it("persists in-app notifications for the room members (deduped)", async () => {
    const store = createMemoryOpsStore();
    const env = notifyEnv([{ user_id: "u1" }, { user_id: "u2" }, { user_id: "u2" }]);
    const result = await executeOpsTool(
      store,
      defaultOpsPolicy(),
      env,
      "notify.send",
      { message: "Deploy unfrozen", role: "member", incident: { title: "DB down" } },
      { projectId: "p1", roomId: "r1" },
    );
    expect(result).toMatchObject({ ok: true, notified: 2, recipients: 2 });
    const notificationInserts = env.inserts.filter((sql) => sql.includes("in_app_notifications"));
    expect(notificationInserts).toHaveLength(2);
  });

  it("prefers an explicit user", async () => {
    const store = createMemoryOpsStore();
    const env = notifyEnv([{ user_id: "u1" }]);
    const result = await executeOpsTool(
      store,
      defaultOpsPolicy(),
      env,
      "notify.send",
      { userId: "u9", message: "ping" },
      { projectId: "p1", roomId: "r1" },
    );
    expect(result).toMatchObject({ ok: true, notified: 1, recipients: 1 });
    expect(env.inserts.some((sql) => sql.includes("room_members"))).toBe(false);
  });

  it("reports zero recipients instead of failing the run", async () => {
    const store = createMemoryOpsStore();
    const env = notifyEnv();
    const result = await executeOpsTool(
      store,
      defaultOpsPolicy(),
      env,
      "notify.send",
      { message: "ping" },
      { projectId: "p1" },
    );
    expect(result).toMatchObject({ ok: true, notified: 0 });
  });
});

describe("executeOpsTool mcp.call", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gates the source by policy and the tool by the registry allowlist", async () => {
    const store = createMemoryOpsStore();
    const env = { ALLOWED_SSRF_HOSTS: "mcp.example.com" };

    const denied = await executeOpsTool(
      store,
      { ...defaultOpsPolicy(), allowedSources: ["files"] },
      env,
      "mcp.call",
      { server: "metrics", tool: "query" },
      { projectId: "p1" },
    );
    expect(denied).toEqual({ ok: false, error: "source_not_allowed" });

    await store.upsertMcpServer("p1", {
      name: "metrics",
      url: "https://mcp.example.com/mcp",
      allowedTools: ["query"],
      enabled: true,
    });
    const notAllowed = await executeOpsTool(
      store,
      defaultOpsPolicy(),
      env,
      "mcp.call",
      { server: "metrics", tool: "restart" },
      { projectId: "p1" },
    );
    expect(notAllowed.error).toBe("tool_not_allowed");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        const body = JSON.parse(init.body);
        const json = (payload) =>
          new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
        if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
        if (body.method === "initialize") return json({ jsonrpc: "2.0", id: body.id, result: { serverInfo: { name: "mock" } } });
        return json({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "pod restarted" }] } });
      }),
    );
    const ok = await executeOpsTool(
      store,
      defaultOpsPolicy(),
      env,
      "mcp.call",
      { server: "metrics", tool: "query", arguments: { pod: "api-1" } },
      { projectId: "p1" },
    );
    expect(ok.ok).toBe(true);
    expect(ok.content).toBe("pod restarted");
  });

  it("forwards the run actor to per-user OAuth servers", async () => {
    const store = createMemoryOpsStore();
    const env = {
      ALLOWED_SSRF_HOSTS: "mcp.example.com, auth.example.com",
      WEBHOOK_SECRET_ENCRYPTION_KEY: btoa("0123456789abcdef0123456789abcdef"),
    };
    await store.upsertMcpServer("p1", {
      name: "grafana",
      url: "https://mcp.example.com/mcp",
      auth: "oauth",
      oauthClientId: "client-1",
      oauthAuthorizeUrl: "https://auth.example.com/authorize",
      oauthTokenUrl: "https://auth.example.com/token",
      allowedTools: ["query"],
      enabled: true,
    });
    const seen = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        seen.push({ url: String(url), headers: init.headers || {} });
        const body = JSON.parse(init.body);
        const json = (payload) =>
          new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
        if (body.method === "notifications/initialized") return new Response(null, { status: 202 });
        if (body.method === "initialize") return json({ jsonrpc: "2.0", id: body.id, result: { serverInfo: { name: "mock" } } });
        return json({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "rows" }] } });
      }),
    );

    // No connection for the actor: denied, never downgraded to a shared secret.
    const missing = await executeOpsTool(
      store,
      defaultOpsPolicy(),
      env,
      "mcp.call",
      { server: "grafana", tool: "query" },
      { projectId: "p1", actor: "u1" },
    );
    expect(missing.error).toBe("mcp_connection_required");
    expect(seen).toHaveLength(0);

    const encrypted = await encryptSecret(env, "at-user1");
    const server = await store.getMcpServerByName("p1", "grafana");
    await store.upsertMcpConnection("p1", {
      serverId: server.id,
      userId: "u1",
      accessCiphertext: encrypted.ciphertext,
      accessIv: encrypted.iv,
      tokenUrl: "https://auth.example.com/token",
      clientId: "client-1",
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      status: "active",
    });

    const ok = await executeOpsTool(
      store,
      defaultOpsPolicy(),
      env,
      "mcp.call",
      { server: "grafana", tool: "query" },
      { projectId: "p1", actor: "u1" },
    );
    expect(ok.ok).toBe(true);
    expect(seen.at(-1).headers.authorization).toBe("Bearer at-user1");
  });
});


describe("executeOpsTool incidents.read", () => {
  function incidentEnv() {
    return {
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                async first() {
                  if (!sql.includes("FROM incidents")) return null;
                  return {
                    id: "i1",
                    project_id: "p1",
                    room_id: "r1",
                    title: "DB down",
                    severity: "sev1",
                    status: "acknowledged",
                    started_at: "2026-10-17T08:00:00.000Z",
                    created_at: "2026-10-17T08:00:00.000Z",
                    timeline: "[]",
                    action_items: "[]",
                  };
                },
                async all() {
                  if (!sql.includes("incident_updates")) return { results: [] };
                  return {
                    results: [
                      {
                        id: "up1",
                        incident_id: "i1",
                        project_id: "p1",
                        user_id: "u1",
                        update_type: "alert",
                        content: "Pager fired",
                        metadata: "{}",
                        created_at: "2026-10-17T08:01:00.000Z",
                      },
                      {
                        id: "up2",
                        incident_id: "i1",
                        project_id: "p1",
                        user_id: "u1",
                        update_type: "status_change",
                        content: "Acknowledged",
                        metadata: "{}",
                        created_at: "2026-10-17T08:05:00.000Z",
                      },
                    ],
                  };
                },
                async run() {
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    };
  }

  it("reads an explicit incident with its recent timeline", async () => {
    const store = createMemoryOpsStore();
    const result = await executeOpsTool(
      store,
      defaultOpsPolicy(),
      incidentEnv(),
      "incidents.read",
      { incidentId: "i1", limit: 1 },
      { projectId: "p1" },
    );
    expect(result.ok).toBe(true);
    expect(result.data.incident.title).toBe("DB down");
    expect(result.data.timeline).toHaveLength(1);
    expect(result.data.timeline[0].updateType).toBe("status_change");
    expect(result.text).toContain("DB down");
  });

  it("defaults to the incident carried by the run, keeping trigger fields", async () => {
    const store = createMemoryOpsStore();
    const run = await store.createRun({
      projectId: "p1",
      versionId: "v1",
      roomId: "r1",
      status: "running",
      trigger: { type: "webhook" },
      context: { incident: { id: "i1", phase: "acknowledged" } },
      currentStepId: "triage",
      killSwitch: false,
      cost: {},
    });
    const result = await executeOpsTool(
      store,
      defaultOpsPolicy(),
      incidentEnv(),
      "incidents.read",
      {},
      { projectId: "p1", runId: run.id },
    );
    expect(result.ok).toBe(true);
    expect(result.data.incident.id).toBe("i1");
    expect(result.data.incident.phase).toBe("acknowledged");
  });

  it("asks for an incident instead of failing when the run has none", async () => {
    const store = createMemoryOpsStore();
    const result = await executeOpsTool(
      store,
      defaultOpsPolicy(),
      incidentEnv(),
      "incidents.read",
      {},
      { projectId: "p1" },
    );
    expect(result).toMatchObject({ ok: false, error: "incident_id_required" });
  });
});
