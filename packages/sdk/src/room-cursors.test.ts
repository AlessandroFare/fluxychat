import { describe, expect, it } from "vitest";
import { bindRoomCursors, pageCursorHistory, type FluxyCursorHistoryParams } from "./room-cursors";
import type { FluxyChatRoomConnection } from "./room-connection";
import type { FluxyChatEvent } from "./fluxy-chat-client";
import type { LiveCursor } from "./live-cursors";

function point(userId: string, ts: number, x = 1): LiveCursor {
  return { userId, x, y: 2, pointer: "mouse", ts };
}

describe("FX-CUR-3 cursor history pages", () => {
  it("pages newest-first with exclusive end on next()", async () => {
    const points = [point("ada", 10), point("ada", 20), point("lin", 30), point("ada", 40)];
    const first = pageCursorHistory(points, { limit: 2 });
    expect(first.items.map((row) => row.ts)).toEqual([40, 30]);
    expect(first.hasNext()).toBe(true);
    const second = await first.next();
    expect(second?.items.map((row) => row.ts)).toEqual([20, 10]);
    expect(second?.hasNext()).toBe(false);
    const windowed = pageCursorHistory(points, { start: 10, end: 40 } satisfies FluxyCursorHistoryParams);
    expect(windowed.items.map((row) => row.ts)).toEqual([30, 20]);
  });

  it("FX-CUR-5 subscribe accepts update and rejects other names", () => {
    const seen: string[] = [];
    let anyHandler: ((event: FluxyChatEvent) => void) | null = null;
    const cursors = bindRoomCursors({
      userId: "u",
      onAnyEvent(handler: (event: FluxyChatEvent) => void) {
        anyHandler = handler;
      },
      offAnyEvent() {
        anyHandler = null;
      },
    } as unknown as FluxyChatRoomConnection);
    expect(() => cursors.subscribe("enter" as "update", () => {})).toThrow(/only update/);
    const sub = cursors.subscribe("update", (cursor) => seen.push(cursor.userId));
    anyHandler?.({ type: "cursor", userId: "ada", x: 1, y: 2 } as FluxyChatEvent);
    expect(seen).toEqual(["ada"]);
    sub.off();
  });

  it("getSelf / getOthers split last positions like Spaces", async () => {
    let anyHandler: ((event: FluxyChatEvent) => void) | null = null;
    const cursors = bindRoomCursors({
      userId: "ada",
      onAnyEvent(handler: (event: FluxyChatEvent) => void) {
        anyHandler = handler;
      },
      offAnyEvent() {},
    } as unknown as FluxyChatRoomConnection);
    anyHandler?.({ type: "cursor", userId: "ada", x: 1, y: 1 } as FluxyChatEvent);
    anyHandler?.({ type: "cursor", userId: "bob", x: 9, y: 9 } as FluxyChatEvent);
    await expect(cursors.getSelf()).resolves.toMatchObject({ userId: "ada", x: 1, y: 1 });
    await expect(cursors.getOthers()).resolves.toMatchObject({ bob: { userId: "bob", x: 9, y: 9 } });
  });

  it("history awaits REST trail and merges with the in-session ring", async () => {
    let anyHandler: ((event: FluxyChatEvent) => void) | null = null;
    const cursors = bindRoomCursors({
      userId: "ada",
      onAnyEvent(handler: (event: FluxyChatEvent) => void) {
        anyHandler = handler;
      },
      offAnyEvent() {},
      async fetchCursorHistory() {
        return [point("lin", 5, 3)];
      },
    } as unknown as FluxyChatRoomConnection);
    anyHandler?.({ type: "cursor", userId: "ada", x: 1, y: 1, ts: 40 } as FluxyChatEvent);
    const page = await cursors.history({ limit: 10 });
    expect(page.items.map((row) => row.userId)).toEqual(["ada", "lin"]);
  });
});
