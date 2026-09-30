import { describe, expect, it } from "vitest";
import { roomMemoryListUrl } from "./room-intelligence-client";

describe("roomMemoryListUrl", () => {
  it("adds q only when set", () => {
    expect(roomMemoryListUrl("https://api.example", "lobby")).toBe(
      "https://api.example/rooms/lobby/memory?limit=12",
    );
    expect(roomMemoryListUrl("https://api.example/", "lobby", { q: " pricing ", limit: 8 })).toBe(
      "https://api.example/rooms/lobby/memory?limit=8&q=pricing",
    );
  });
});
