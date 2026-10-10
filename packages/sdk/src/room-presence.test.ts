import { describe, expect, it } from "vitest";
import { bindRoomPresence } from "./room-presence";
import type { FluxyChatRoomConnection } from "./room-connection";
import type { FluxyPresence } from "./presence-patch";

describe("bindRoomPresence", () => {
  it("enter without data still patches; leave sends presence_leave", async () => {
    const sent: Array<Partial<FluxyPresence>> = [];
    const left: Array<Partial<FluxyPresence> | undefined> = [];
    const connection = {
      userId: "ada",
      presenceEventsEnabled: true,
      sendPresencePatch(patch: Partial<FluxyPresence>) {
        sent.push(patch);
      },
      sendPresenceLeave(data?: Partial<FluxyPresence>) {
        left.push(data);
      },
      fetchLiveMembers() {
        return Promise.resolve([{ userId: "ada" }, { userId: "bob" }]);
      },
      onAnyEvent() {},
      offAnyEvent() {},
    } as unknown as FluxyChatRoomConnection;

    const presence = bindRoomPresence(connection);
    presence.enter();
    expect(sent).toEqual([{ agentStatus: null }]);
    presence.update({ uiLocation: "slide-2" });
    presence.leave({ agentStatus: "offline" });
    expect(left).toEqual([{ agentStatus: "offline" }]);
    await expect(presence.isUserPresent("ada")).resolves.toBe(true);
    await expect(presence.isUserPresent("zoe")).resolves.toBe(false);
    await expect(presence.getSelf()).resolves.toEqual({ userId: "ada" });
    await expect(presence.getOthers()).resolves.toEqual([{ userId: "bob" }]);
    await expect(presence.getAll()).resolves.toEqual([{ userId: "ada" }, { userId: "bob" }]);
    await expect(presence.get({ clientId: "bob" })).resolves.toEqual([{ userId: "bob" }]);
    await expect(presence.get({ waitForSync: false })).resolves.toHaveLength(2);
    const states: boolean[] = [];
    presence.onPresenceStateChange((change) => states.push(change.current.present));
    presence.enter();
    presence.leave();
    expect(states).toEqual([true, false]);
  });

  it("FX-PRES-3 subscribe throws when presence events are disabled", () => {
    const presence = bindRoomPresence({
      presenceEventsEnabled: false,
    } as unknown as FluxyChatRoomConnection);
    expect(() => presence.subscribe(() => {})).toThrow(/presence events are disabled/);
  });

  it("FX-PRES-7 get waitForSync waits until connected", async () => {
    let status: "connecting" | "connected" = "connecting";
    const listeners: Array<(next: string) => void> = [];
    let fetches = 0;
    const presence = bindRoomPresence({
      get connectionStatus() {
        return status;
      },
      onConnectionStatus(handler: (next: string) => void) {
        listeners.push(handler);
        return () => {
          const idx = listeners.indexOf(handler);
          if (idx >= 0) listeners.splice(idx, 1);
        };
      },
      fetchLiveMembers() {
        fetches += 1;
        return Promise.resolve([{ userId: "ada" }]);
      },
      presenceEventsEnabled: true,
      onAnyEvent() {},
      offAnyEvent() {},
    } as unknown as FluxyChatRoomConnection);
    const pending = presence.get();
    expect(fetches).toBe(0);
    await expect(presence.get({ waitForSync: false })).resolves.toEqual([{ userId: "ada" }]);
    expect(fetches).toBe(1);
    status = "connected";
    for (const handler of listeners) handler("connected");
    await expect(pending).resolves.toEqual([{ userId: "ada" }]);
    expect(fetches).toBe(2);
  });

  it("FX-PRES-4 maps join/leave/patch to enter/leave/update and present", () => {
    const seen: Array<{ type: string; userId: string }> = [];
    let listener: ((event: {
      type: string;
      userId?: string;
      members?: Array<{ userId: string }>;
      data?: FluxyPresence;
    }) => void) | null = null;
    const presence = bindRoomPresence({
      presenceEventsEnabled: true,
      onAnyEvent(handler: typeof listener) {
        listener = handler;
      },
      offAnyEvent() {
        listener = null;
      },
    } as unknown as FluxyChatRoomConnection);
    presence.subscribe((event) => seen.push({ type: event.type, userId: event.member.userId }));
    listener?.({ type: "member_joined", userId: "ada" });
    listener?.({ type: "presence_patch", userId: "ada", data: { uiLocation: "slide-2" } as FluxyPresence });
    listener?.({ type: "member_left", userId: "ada" });
    listener?.({ type: "subscription_succeeded", members: [{ userId: "bob" }] });
    expect(seen).toEqual([
      { type: "enter", userId: "ada" },
      { type: "update", userId: "ada" },
      { type: "leave", userId: "ada" },
      { type: "present", userId: "bob" },
    ]);
  });

  it("FX-PRES-5 subscribe filters by event type", () => {
    const seen: string[] = [];
    let listener: ((event: { type: string; userId?: string }) => void) | null = null;
    const presence = bindRoomPresence({
      presenceEventsEnabled: true,
      onAnyEvent(handler: typeof listener) {
        listener = handler;
      },
      offAnyEvent() {
        listener = null;
      },
    } as unknown as FluxyChatRoomConnection);
    presence.subscribe("leave", (event) => seen.push(event.member.userId));
    listener?.({ type: "member_joined", userId: "ada" });
    listener?.({ type: "member_left", userId: "ada" });
    expect(seen).toEqual(["ada"]);
  });
});
