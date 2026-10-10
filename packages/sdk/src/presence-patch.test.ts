import { describe, expect, it } from "vitest";
import { buildPresencePatchOutbound, parsePresencePatchEvent } from "./presence-patch";

describe("presence patch", () => {
  it("parses inbound selection patches", () => {
    expect(
      parsePresencePatchEvent({
        type: "presence_patch",
        userId: "ada",
        data: { selection: { x: 1, y: 2, x2: 8, y2: 9 } },
      }),
    ).toEqual({ selection: { x: 1, y: 2, x2: 8, y2: 9 } });
  });

  it("builds outbound frames", () => {
    expect(buildPresencePatchOutbound({ selection: null })).toEqual({
      type: "presence_patch",
      data: { selection: null },
    });
    expect(buildPresencePatchOutbound({})).toBeNull();
  });

  it("round-trips uiLocation without touching GPS", () => {
    expect(
      buildPresencePatchOutbound({ uiLocation: { surface: "slide", id: "3" } }),
    ).toEqual({
      type: "presence_patch",
      data: { uiLocation: { surface: "slide", id: "3" } },
    });
    expect(
      parsePresencePatchEvent({
        type: "presence_patch",
        userId: "ada",
        data: { ui_location: "deck:4" },
      }),
    ).toEqual({ uiLocation: "deck:4" });
  });

  it("round-trips agentStatus", () => {
    expect(buildPresencePatchOutbound({ agentStatus: "running" })).toEqual({
      type: "presence_patch",
      data: { agentStatus: "running" },
    });
    expect(
      parsePresencePatchEvent({
        type: "presence_patch",
        userId: "bot",
        data: { agentStatus: "idle" },
      }),
    ).toEqual({ agentStatus: "idle" });
  });
});
