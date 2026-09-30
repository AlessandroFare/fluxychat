import { describe, expect, it } from "vitest";
import { FLUXY_AGENT_SUGGESTIONS_MAP_KEY } from "./yjs-agent-suggestions";

describe("FLUXY_AGENT_SUGGESTIONS_MAP_KEY", () => {
  it("matches the Worker map name", () => {
    expect(FLUXY_AGENT_SUGGESTIONS_MAP_KEY).toBe("fluxy_agent_suggestions");
  });
});
