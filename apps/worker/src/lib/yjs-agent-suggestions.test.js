import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  FLUXY_AGENT_SUGGESTIONS_MAP_KEY,
  FLUXY_YJS_STORAGE_MAP_KEY,
  upsertAgentSuggestionInDoc,
  applySuggestionToStorageMap,
  readAgentSuggestionFromDoc,
} from "./yjs-agent-suggestions.js";

describe("yjs-agent-suggestions", () => {
  it("upserts a pending suggestion and applies it onto storage", () => {
    const doc = new Y.Doc();
    upsertAgentSuggestionInDoc(doc, {
      id: "sug_1",
      agentId: "bot-legal",
      storageKey: "clause",
      value: "strike para 4",
      comment: "Conflicts with the exclusivity term.",
      status: "pending",
    });
    expect(doc.getMap(FLUXY_AGENT_SUGGESTIONS_MAP_KEY).has("sug_1")).toBe(true);
    const row = readAgentSuggestionFromDoc(doc, "sug_1");
    expect(row?.comment).toMatch(/exclusivity/);
    applySuggestionToStorageMap(doc, { ...row, status: "accepted" });
    expect(doc.getMap(FLUXY_YJS_STORAGE_MAP_KEY).get("clause")).toBe("strike para 4");
  });

  it("lists suggestions in createdAt order", async () => {
    const { listAgentSuggestionsFromDoc } = await import("./yjs-agent-suggestions.js");
    const doc = new Y.Doc();
    upsertAgentSuggestionInDoc(doc, {
      id: "b",
      storageKey: "k",
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    upsertAgentSuggestionInDoc(doc, {
      id: "a",
      storageKey: "k",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(listAgentSuggestionsFromDoc(doc).map((row) => row.id)).toEqual(["a", "b"]);
  });
});
