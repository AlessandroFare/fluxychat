import { describe, expect, it } from "vitest";
import { highestRoomSeq, resumeLogEventToClientEvent } from "./seq-resume";

describe("highestRoomSeq", () => {
  it("reads lastSeq, currentSeq, nested events", () => {
    expect(
      highestRoomSeq({
        type: "replay",
        lastSeq: 4,
        currentSeq: 9,
        events: [{ seq: 7 }, { seq: 8 }],
      }),
    ).toBe(9);
  });
});

describe("resumeLogEventToClientEvent", () => {
  it("maps create/update/delete payloads", () => {
    expect(
      resumeLogEventToClientEvent({
        seq: 1,
        messageId: 10,
        eventType: "create",
        payload: { id: 10, content: "hi", userId: "u" },
      }),
    ).toEqual({ type: "message", id: 10, seq: 1, content: "hi", userId: "u" });

    expect(
      resumeLogEventToClientEvent({
        seq: 2,
        messageId: 10,
        eventType: "update",
        payload: { id: 10, content: "hey" },
      }),
    ).toMatchObject({ type: "edit", id: 10, seq: 2, content: "hey" });

    expect(
      resumeLogEventToClientEvent({
        seq: 3,
        messageId: 10,
        eventType: "delete",
        payload: { id: 10 },
      }),
    ).toMatchObject({ type: "delete", id: 10, seq: 3 });
  });
});
