import { describe, it, expect } from "vitest";
import {
  isWatchlistTargetType,
  WATCHLIST_ROOM_EVENT_TYPES,
} from "./user-watchlist.js";

describe("user-watchlist", () => {
  it("validates target types", () => {
    expect(isWatchlistTargetType("room")).toBe(true);
    expect(isWatchlistTargetType("user")).toBe(true);
    expect(isWatchlistTargetType("channel")).toBe(false);
  });

  it("defines room event types for fanout", () => {
    expect(WATCHLIST_ROOM_EVENT_TYPES.has("message")).toBe(true);
    expect(WATCHLIST_ROOM_EVENT_TYPES.has("typing")).toBe(false);
  });
});
