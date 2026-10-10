import { describe, expect, it } from "vitest";
import { occupancyEventFromData, occupancyFromEvent, occupancyFromLive } from "./occupancy";

describe("occupancy", () => {
  it("maps live snapshot and occupancy frames", () => {
    expect(
      occupancyFromLive({ subscriptionCount: 4, userCount: 2, members: [{ userId: "a" }, { userId: "b" }] }),
    ).toEqual({ connections: 4, presenceMembers: 2, watching: 2 });
    expect(occupancyFromEvent({ connections: 3, presenceMembers: 1 })).toEqual({
      connections: 3,
      presenceMembers: 1,
      watching: 2,
    });
    expect(occupancyEventFromData({ connections: 1, presenceMembers: 0, watching: 1 })).toEqual({
      type: "occupancy.updated",
      occupancy: { connections: 1, presenceMembers: 0, watching: 1 },
    });
  });
});
