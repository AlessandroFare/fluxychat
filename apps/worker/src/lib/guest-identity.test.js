import { describe, expect, it } from "vitest";
import { deriveStableGuestUserId } from "./guest-identity.js";

describe("deriveStableGuestUserId", () => {
  it("is stable for the same key and room", async () => {
    const a = await deriveStableGuestUserId("proj", "lobby", "abcdefghijklmnop");
    const b = await deriveStableGuestUserId("proj", "lobby", "abcdefghijklmnop");
    expect(a).toBe(b);
    expect(a).toMatch(/^guest_[a-f0-9]{22}$/);
  });

  it("changes when the room or key changes", async () => {
    const a = await deriveStableGuestUserId("proj", "lobby", "abcdefghijklmnop");
    const b = await deriveStableGuestUserId("proj", "other", "abcdefghijklmnop");
    const c = await deriveStableGuestUserId("proj", "lobby", "qrstuvwxyz012345");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it("rejects short keys", async () => {
    expect(await deriveStableGuestUserId("proj", "lobby", "short")).toBeNull();
  });
});
