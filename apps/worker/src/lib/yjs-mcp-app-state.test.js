import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  FLUXY_MCP_APP_STATE_MAP_KEY,
  shouldPreferMcpAppState,
  upsertMcpAppStateInDoc,
  readMcpAppStateFromDoc,
} from "./yjs-mcp-app-state.js";

describe("yjs-mcp-app-state", () => {
  it("upserts by appId", () => {
    const doc = new Y.Doc();
    upsertMcpAppStateInDoc(doc, {
      appId: "ui://forms/deal",
      state: { step: 1 },
      version: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(doc.getMap(FLUXY_MCP_APP_STATE_MAP_KEY).has("ui://forms/deal")).toBe(true);
    expect(readMcpAppStateFromDoc(doc, "ui://forms/deal")?.state).toEqual({ step: 1 });
  });

  it("keeps the higher version", () => {
    expect(
      shouldPreferMcpAppState(
        { version: 1, updatedAt: "2026-01-01T00:00:00.000Z" },
        { version: 2, updatedAt: "2026-01-01T00:00:00.000Z" },
      ),
    ).toBe(true);
  });
});
