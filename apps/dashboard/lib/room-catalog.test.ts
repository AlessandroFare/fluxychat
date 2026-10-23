import { describe, expect, it } from "vitest";
import {
  FEATURED_ROOMS,
  ROOM_CATALOG,
  ROOM_STATUS_LEGEND,
  SUPPORTING_ROOMS,
  roomBySlug,
  roomPageHref,
} from "./room-catalog";

describe("room catalog", () => {
  it("keeps slugs unique and the atlas balanced", () => {
    const slugs = ROOM_CATALOG.map((room) => room.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(ROOM_CATALOG).toHaveLength(12);
    expect(FEATURED_ROOMS).toHaveLength(5);
    expect(SUPPORTING_ROOMS).toHaveLength(7);
    expect(FEATURED_ROOMS.every((room) => room.featured)).toBe(true);
  });

  it("gives every room the fields its page and modal need", () => {
    for (const room of ROOM_CATALOG) {
      expect(room.name.length).toBeGreaterThan(0);
      expect(room.tag.length).toBeGreaterThan(0);
      expect(room.summary.length).toBeGreaterThan(0);
      expect(room.lede.length).toBeGreaterThan(0);
      expect(room.description.length).toBeGreaterThan(0);
      expect(room.notFor.length).toBeGreaterThan(0);
      expect(room.surfaces).toHaveLength(3);
      expect(ROOM_STATUS_LEGEND[room.status]).toBeTruthy();
      expect(roomPageHref(room)).toBe(`/solutions/${room.slug}`);
      if (room.consoleHref) expect(room.consoleHref.startsWith("/")).toBe(true);
    }
  });

  it("looks rooms up by slug and rejects unknown ones", () => {
    expect(roomBySlug("chat-core")?.name).toBe("In-App Chat");
    expect(roomBySlug("spatial-twin")?.status).toBe("Labs");
    expect(roomBySlug("not-a-room")).toBeNull();
  });
});
