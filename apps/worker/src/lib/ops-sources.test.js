import { describe, expect, it } from "vitest";
import { createMemoryOpsStore } from "./ops-store.js";
import { defaultOpsPolicy } from "./ops-policy.js";
import { normalizeSearchHits } from "./ops-search-hits.js";
import { describeOpsSources, executeOpsTool, ingestOpsFile, queryNamedView, searchOpsFiles } from "./ops-sources.js";

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
