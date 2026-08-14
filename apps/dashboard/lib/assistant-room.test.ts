import { describe, expect, it } from "vitest";
import {
  assistantRoomId,
  mentionPrefixForAgent,
  pickDefaultAssistantAgent,
  projectIdFromAssistantRoomId,
} from "./assistant-room";

describe("assistant-room", () => {
  it("pickDefaultAssistantAgent prefers @assistant", () => {
    const agents = [
      { id: "builtin-moderator-x", handle: "@moderator" },
      { id: "builtin-assistant-x", handle: "@assistant" },
      { id: "builtin-onboarding-x", handle: "onboarding" },
    ];
    expect(pickDefaultAssistantAgent(agents)?.id).toBe("builtin-assistant-x");
  });

  it("pickDefaultAssistantAgent falls back to onboarding then first", () => {
    expect(
      pickDefaultAssistantAgent([{ id: "a", handle: "@onboarding" }])?.id,
    ).toBe("a");
    expect(pickDefaultAssistantAgent([{ id: "only", handle: "bot" }])?.id).toBe(
      "only",
    );
  });

  it("mentionPrefixForAgent strips leading @", () => {
    expect(mentionPrefixForAgent("@assistant")).toBe("@assistant ");
    expect(assistantRoomId("general")).toBe("assistant-general");
    expect(projectIdFromAssistantRoomId("assistant-general")).toBe("general");
    expect(projectIdFromAssistantRoomId("support-room")).toBeNull();
  });
});
