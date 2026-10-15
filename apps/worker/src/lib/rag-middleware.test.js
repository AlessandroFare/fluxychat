import { describe, expect, it } from "vitest";
import { createRagMiddleware } from "./rag-middleware.js";

describe("rag citations", () => {
  it("returns the same citation shape as files.search", async () => {
    const rag = createRagMiddleware({
      retriever: {
        async search() {
          return [{ id: "doc1", content: "hello", score: 0.7, source: "kb.md" }];
        },
      },
    });
    const out = await rag.enhancePrompt("hello");
    expect(out.citations[0]).toEqual({ sourceId: "doc1", title: "kb.md", score: 0.7 });
  });
});
