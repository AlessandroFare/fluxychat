import { describe, expect, it } from "vitest";
import { copyChatMessage, withChatMessage } from "./message-with";
import type { FluxyChatMessage } from "./fluxy-chat-client";
import { emptyReactionSummary } from "./reaction-summary";

const base: FluxyChatMessage = {
  id: 9,
  serial: "9",
  roomId: "lobby",
  userId: "ada",
  content: "hi",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("withChatMessage", () => {
  it("FX-MSG-2 applies update/delete and rejects created", () => {
    const updated = withChatMessage(base, {
      type: "message.updated",
      message: { ...base, content: "bye", text: "bye" },
    });
    expect(updated.content).toBe("bye");
    expect(updated.text).toBe("bye");
    const deleted = withChatMessage(base, {
      type: "message.deleted",
      message: { ...base, deletedAt: "2026-01-02T00:00:00.000Z" },
    });
    expect(deleted.deletedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(() =>
      withChatMessage(base, { type: "message.created", message: base }),
    ).toThrow(/unable to apply created event/);
    const copied = copyChatMessage(base, { text: "copied" });
    expect(copied.content).toBe("copied");
    expect(copied.text).toBe("copied");
    const summary = emptyReactionSummary(9);
    summary.distinct["👍"] = { total: 1, clientIds: ["ada"] };
    const reacted = withChatMessage(base, {
      type: "reaction.summary",
      messageSerial: "9",
      reactions: summary,
    });
    expect(reacted.reactions).toEqual({ "👍": 1 });
  });

  it("FX-MSG-3 stamps version and skips older edits", () => {
    const later = withChatMessage(base, {
      type: "message.updated",
      message: { ...base, content: "v2", editedAt: "2026-01-02T00:00:00.000Z" },
    });
    expect(later.content).toBe("v2");
    expect(later.version?.serial).toBe("9:2026-01-02T00:00:00.000Z");
    expect(later.clientId).toBe("ada");
    const skipped = withChatMessage(later, {
      type: "message.updated",
      message: { ...base, content: "stale", editedAt: "2026-01-01T12:00:00.000Z" },
    });
    expect(skipped).toBe(later);
    expect(skipped.content).toBe("v2");
  });
});
