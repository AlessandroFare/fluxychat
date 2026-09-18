import { describe, expect, it } from "vitest";
import { roomsListEmptyCopy } from "./rooms-empty-copy";

describe("roomsListEmptyCopy", () => {
  it("tells you to paste a JWT when the console has no session", () => {
    const copy = roomsListEmptyCopy(false);
    expect(copy.title).toBe("Connect a session");
    expect(copy.description).toMatch(/JWT/);
    expect(copy.description).toMatch(/Projects/);
  });

  it("uses the empty-list copy when a JWT is present", () => {
    const copy = roomsListEmptyCopy(true);
    expect(copy.title).toBe("No rooms yet");
    expect(copy.description).toMatch(/Create your first room/);
  });
});
