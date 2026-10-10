import { describe, expect, it } from "vitest";
import { bindRoomLocations } from "./room-locations";
import type { FluxyChatRoomConnection } from "./room-connection";
import type { FluxyChatEvent } from "./fluxy-chat-client";
import type { FluxyPresence } from "./presence-patch";

describe("bindRoomLocations", () => {
  it("set sends uiLocation; subscribe emits previous and current", async () => {
    const sent: Array<Partial<FluxyPresence>> = [];
    let anyHandler: ((event: FluxyChatEvent) => void) | null = null;
    const connection = {
      userId: "ada",
      sendPresencePatch(patch: Partial<FluxyPresence>) {
        sent.push(patch);
      },
      onAnyEvent(handler: (event: FluxyChatEvent) => void) {
        anyHandler = handler;
      },
      offAnyEvent() {
        anyHandler = null;
      },
    } as unknown as FluxyChatRoomConnection;

    const locations = bindRoomLocations(connection);
    locations.set({ surface: "slide", id: "3" });
    expect(sent).toEqual([{ uiLocation: { surface: "slide", id: "3" } }]);

    const seen: Array<{ current: unknown; previous: unknown }> = [];
    locations.subscribe((change) =>
      seen.push({
        current: change.current,
        previous: change.previous,
        currentLocation: change.currentLocation,
        member: change.member,
      }),
    );
    anyHandler?.({
      type: "presence_patch",
      userId: "ada",
      data: { uiLocation: { surface: "slide", id: "3" } },
    } as FluxyChatEvent);
    expect(seen[0]).toEqual({
      current: { surface: "slide", id: "3" },
      previous: { surface: "slide", id: "3" },
      currentLocation: { surface: "slide", id: "3" },
      member: { userId: "ada" },
    });
    await expect(locations.getSelf()).resolves.toEqual({ surface: "slide", id: "3" });
    await expect(locations.getAll()).resolves.toMatchObject({ ada: { surface: "slide", id: "3" } });
    await expect(locations.getOthers()).resolves.toEqual({});
  });
});
