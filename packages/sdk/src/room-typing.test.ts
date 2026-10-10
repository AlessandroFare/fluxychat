import { describe, expect, it, vi } from "vitest";
import { bindRoomTyping, TYPING_THROTTLE_MS } from "./room-typing";
import type { FluxyChatRoomConnection } from "./room-connection";

describe("bindRoomTyping", () => {
  it("FX-TYP-1 throttles keystroke and tracks inbound typers", () => {
    vi.useFakeTimers();
    const sent: boolean[] = [];
    let anyHandler: ((event: { type: string; userId?: string; isTyping?: boolean }) => void) | null =
      null;
    const connection = {
      typingHeartbeatThrottleMs: TYPING_THROTTLE_MS,
      sendTyping(isTyping: boolean, _parentId?: number | null) {
        sent.push(isTyping);
      },
      onAnyEvent(handler: typeof anyHandler) {
        anyHandler = handler;
      },
    } as unknown as FluxyChatRoomConnection;

    const typing = bindRoomTyping(connection);
    typing.keystroke();
    typing.start();
    expect(sent).toEqual([true]);
    expect(typing.currentTypers()).toEqual([]);
    vi.advanceTimersByTime(TYPING_THROTTLE_MS);
    typing.keystroke();
    expect(sent).toEqual([true, true]);
    const events: Array<{ userId: string; isTyping: boolean }> = [];
    typing.subscribe((event) => events.push(event.change));
    anyHandler?.({ type: "typing", userId: "ada", isTyping: true });
    expect([...typing.current()]).toEqual(["ada"]);
    expect(typing.current.size).toBe(1);
    expect(typing.current.has("ada")).toBe(true);
    expect(typing.currentTypers()).toEqual([{ userId: "ada", clientId: "ada" }]);
    expect(events).toEqual([
      { userId: "ada", clientId: "ada", isTyping: true, type: "typing.started" },
    ]);
    typing.stop();
    expect(sent.at(-1)).toBe(false);
    vi.useRealTimers();
  });

  it("sends Stream keystroke parentId and ignores thread typers in room current", () => {
    const sent: Array<[boolean, number | null | undefined]> = [];
    let anyHandler: ((event: {
      type: string;
      userId?: string;
      isTyping?: boolean;
      parentId?: number;
    }) => void) | null = null;
    const connection = {
      typingHeartbeatThrottleMs: 0,
      sendTyping(isTyping: boolean, parentId?: number | null) {
        sent.push([isTyping, parentId]);
      },
      onAnyEvent(handler: typeof anyHandler) {
        anyHandler = handler;
      },
    } as unknown as FluxyChatRoomConnection;
    const typing = bindRoomTyping(connection);
    typing.keystroke(42);
    expect(sent[0]).toEqual([true, 42]);
    anyHandler?.({ type: "typing", userId: "ada", isTyping: true, parentId: 42 });
    expect([...typing.current()]).toEqual([]);
    anyHandler?.({ type: "typing", userId: "bob", isTyping: true });
    expect([...typing.current()]).toEqual(["bob"]);
  });
});
