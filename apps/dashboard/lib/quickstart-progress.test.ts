import { beforeEach, describe, expect, it } from "vitest";
import {
  isQuickstartComplete,
  loadQuickstartProgress,
  markQuickstartComplete,
  QUICKSTART_STORAGE_BASE,
} from "./quickstart-progress";
import { scopedStorageKey } from "./scoped-browser-storage";

const USER_A = "user_a";
const USER_B = "user_b";

describe("quickstart-progress", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("does not treat another user's completion as complete", () => {
    markQuickstartComplete(USER_A);

    const completeForB = isQuickstartComplete(USER_B, {
      adminJwt: "x".repeat(12),
      memberJwt: "y".repeat(12),
      activeProjectId: "proj_1",
      lastRoomId: "room_1",
    });

    expect(completeForB).toBe(false);
  });

  it("ignores legacy unscoped completion blob", () => {
    window.localStorage.setItem(
      QUICKSTART_STORAGE_BASE,
      JSON.stringify({ completedAt: new Date().toISOString(), firstMessageSent: true }),
    );

    expect(loadQuickstartProgress(USER_B)).toEqual({});
    expect(
      isQuickstartComplete(USER_B, {
        adminJwt: "x".repeat(12),
        memberJwt: "y".repeat(12),
        activeProjectId: "proj_1",
        lastRoomId: "room_1",
      }),
    ).toBe(false);
  });

  it("marks complete only for the scoped user key", () => {
    markQuickstartComplete(USER_A);

    expect(
      window.localStorage.getItem(scopedStorageKey(QUICKSTART_STORAGE_BASE, USER_A)),
    ).toContain(USER_A);
    expect(
      isQuickstartComplete(USER_A, {
        adminJwt: "",
        memberJwt: "",
        activeProjectId: null,
        lastRoomId: null,
      }),
    ).toBe(true);
  });
});
