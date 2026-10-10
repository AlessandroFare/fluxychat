import { describe, expect, it, vi } from "vitest";
import { bindRoomMembers } from "./room-members";
import type { FluxyChatRoomConnection } from "./room-connection";
import type { FluxyChatEvent } from "./fluxy-chat-client";

describe("bindRoomMembers", () => {
  it("FX-MEM-1 enter/leave/remove and getAll includes leavers until timeout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    let listener: ((event: FluxyChatEvent) => void) | null = null;
    const patches: unknown[] = [];
    const connection = {
      userId: "ada",
      membersOfflineTimeoutMs: 5_000,
      fetchLiveMembers() {
        return Promise.resolve([{ userId: "ada" }]);
      },
      sendPresencePatch(data: unknown) {
        patches.push(data);
      },
      onAnyEvent(handler: (event: FluxyChatEvent) => void) {
        listener = handler;
      },
    } as unknown as FluxyChatRoomConnection;

    const members = bindRoomMembers(connection);
    const seen: string[] = [];
    members.subscribe((event) => seen.push(`${event.type}:${event.member.userId}`));
    members.subscribe("leave", (event) => seen.push(`only-leave:${event.member.userId}`));

    listener?.({ type: "member_joined", roomId: "lobby", userId: "bob" });
    listener?.({ type: "member_left", roomId: "lobby", userId: "bob" });
    expect(seen).toEqual([
      "enter:bob",
      "update:bob",
      "leave:bob",
      "only-leave:bob",
      "update:bob",
    ]);
    const all = await members.getAll();
    expect(all.some((row) => row.userId === "bob" && row.isConnected === false)).toBe(true);

    vi.advanceTimersByTime(5_000);
    expect(seen.filter((row) => row.startsWith("remove"))).toEqual(["remove:bob"]);
    members.updateProfile({ uiLocation: "slide-2" });
    expect(patches).toEqual([{ uiLocation: "slide-2" }]);
    vi.useRealTimers();
  });
});
