import { describe, expect, it } from "vitest";
import {
  createVectorizeRetriever,
  embedTextForVectorize,
  parseVectorizeMemoryId,
  queryVectorizeRoomMemory,
  upsertRoomMemoryVector,
  vectorizeMemoryId,
} from "./vectorize-retriever.js";

describe("vectorize-retriever", () => {
  it("no-ops without VECTORIZE", async () => {
    const env = {};
    expect(await embedTextForVectorize(env, "hi")).toBeNull();
    expect(await queryVectorizeRoomMemory(env, { projectId: "p", roomId: "r", query: "x" })).toEqual([]);
    expect(await upsertRoomMemoryVector(env, { projectId: "p", roomId: "r", entryId: "e", content: "c" })).toEqual({
      ok: false,
      reason: "unbound",
    });
  });

  it("queries only ids for this room", async () => {
    const env = {
      AI: {
        run: async () => ({ data: [[0.1, 0.2, 0.3]] }),
      },
      VECTORIZE: {
        query: async () => ({
          matches: [
            { id: vectorizeMemoryId("p", "r", "keep"), score: 0.9 },
            { id: vectorizeMemoryId("p", "other", "skip"), score: 0.99 },
          ],
        }),
      },
    };
    const hits = await queryVectorizeRoomMemory(env, { projectId: "p", roomId: "r", query: "pricing" });
    expect(hits).toEqual([{ entryId: "keep", score: 0.9 }]);
    expect(parseVectorizeMemoryId(vectorizeMemoryId("p", "r", "keep"))).toEqual({
      projectId: "p",
      roomId: "r",
      entryId: "keep",
    });
  });

  it("createVectorizeRetriever search uses the index", async () => {
    const env = {
      AI: { run: async () => ({ data: [0.1, 0.2] }) },
      VECTORIZE: {
        query: async () => ({ matches: [{ id: vectorizeMemoryId("p", "r", "e1"), score: 0.8 }] }),
      },
    };
    const retriever = createVectorizeRetriever(env);
    const docs = await retriever.search("q", { projectId: "p", roomId: "r" });
    expect(docs[0].id).toBe("e1");
    expect(docs[0].source).toBe("vectorize");
  });
});
