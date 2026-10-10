import { describe, expect, it } from "vitest";
import {
  classifyPresenceAvatars,
  forgetLeaver,
  pruneLeavers,
  rememberLeaver,
  selfFromMembers,
} from "./presence-avatars";

describe("presence avatars", () => {
  it("splits self / others / leavers until TTL", () => {
    const members = [
      { userId: "me", userInfo: { name: "Me" } },
      { userId: "ada" },
    ];
    expect(selfFromMembers(members, "me")?.userInfo).toEqual({ name: "Me" });
    let leavers = rememberLeaver({}, { userId: "bob", userInfo: { name: "Bob" } }, 1_000);
    const now = 2_000;
    const avatars = classifyPresenceAvatars({
      selfUserId: "me",
      members,
      leavers,
      now,
      ttlMs: 5_000,
    });
    expect(avatars.map((a) => a.role)).toEqual(["self", "other", "leaver"]);
    leavers = forgetLeaver(leavers, "bob");
    expect(classifyPresenceAvatars({ selfUserId: "me", members, leavers, now }).some((a) => a.role === "leaver")).toBe(
      false,
    );
    leavers = rememberLeaver({}, { userId: "old" }, 0);
    expect(pruneLeavers(leavers, 200_000)["old"]).toBeUndefined();
  });
});
