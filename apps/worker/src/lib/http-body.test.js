import { describe, expect, it } from "vitest";
import {
  parseAuthTokenBody,
  parseCreateRoomBody,
  parsePostMessageBody,
  parseAgentInvokeBody,
  parseWebhookRegisterBody,
  parseBotUpsertBody,
  parseReportCreateBody,
  parsePresenceUpdateBody,
  parseEventsTriggerBody,
  parsePushDeviceBody,
} from "./http-body.js";

describe("parseAuthTokenBody", () => {
  it("rejects non-objects", () => {
    expect(parseAuthTokenBody(null).ok).toBe(false);
    expect(parseAuthTokenBody([]).ok).toBe(false);
  });

  it("requires string userId", () => {
    expect(parseAuthTokenBody({ userId: 1 }).ok).toBe(false);
    expect(parseAuthTokenBody({ userId: "alice" }).ok).toBe(true);
  });

  it("rejects non-string roles", () => {
    expect(parseAuthTokenBody({ userId: "a", roles: "admin" }).ok).toBe(false);
  });
});

describe("parseCreateRoomBody", () => {
  it("rejects non-objects", () => {
    expect(parseCreateRoomBody(null).ok).toBe(false);
    expect(parseCreateRoomBody([]).ok).toBe(false);
  });

  it("passes through room fields", () => {
    const parsed = parseCreateRoomBody({
      name: "general",
      type: "group",
      id: "room-1",
      members: [{ userId: "u1", role: "owner" }],
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.name).toBe("general");
    expect(parsed.type).toBe("group");
    expect(parsed.id).toBe("room-1");
    expect(parsed.members).toHaveLength(1);
  });
});

describe("parsePostMessageBody", () => {
  it("requires string roomId", () => {
    expect(parsePostMessageBody(null).ok).toBe(false);
    expect(parsePostMessageBody({ roomId: 1 }).ok).toBe(false);
    expect(parsePostMessageBody({ roomId: "r1" }).ok).toBe(true);
  });
});

describe("parseAgentInvokeBody", () => {
  it("requires roomId and content", () => {
    expect(parseAgentInvokeBody({ roomId: "r" }).ok).toBe(false);
    expect(parseAgentInvokeBody({ content: "hi" }).ok).toBe(false);
    const ok = parseAgentInvokeBody({ roomId: "r", content: "hi", depth: 1 });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.depth).toBe(1);
  });
});

describe("parseWebhookRegisterBody", () => {
  it("requires url and eventTypes array", () => {
    expect(parseWebhookRegisterBody({ url: "https://x.test" }).ok).toBe(false);
    expect(
      parseWebhookRegisterBody({
        url: "https://x.test/hook",
        eventTypes: ["message.created"],
      }).ok,
    ).toBe(true);
  });
});

describe("parseBotUpsertBody", () => {
  it("requires name", () => {
    expect(parseBotUpsertBody({}).ok).toBe(false);
    expect(parseBotUpsertBody({ name: "Helper" }).ok).toBe(true);
  });
});

describe("parseReportCreateBody", () => {
  it("requires messageId and roomId", () => {
    expect(parseReportCreateBody({ messageId: 1 }).ok).toBe(false);
    expect(parseReportCreateBody({ messageId: 1, roomId: "r1" }).ok).toBe(true);
  });
});

describe("parsePresenceUpdateBody", () => {
  it("requires type", () => {
    expect(parsePresenceUpdateBody({}).ok).toBe(false);
    const ok = parsePresenceUpdateBody({ type: "cursor", payload: { x: 1 } });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.type).toBe("cursor");
  });
});

describe("parseEventsTriggerBody", () => {
  it("requires roomIds", () => {
    expect(parseEventsTriggerBody({ name: "x" }).ok).toBe(false);
    expect(parseEventsTriggerBody({ roomIds: ["r1"], name: "custom" }).ok).toBe(true);
  });
});

describe("parsePushDeviceBody", () => {
  it("requires platform and token", () => {
    expect(parsePushDeviceBody({ platform: "ios" }).ok).toBe(false);
    expect(parsePushDeviceBody({ platform: "ios", token: "abc" }).ok).toBe(true);
  });
});
