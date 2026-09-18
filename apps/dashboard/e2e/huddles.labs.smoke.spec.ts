import { test } from "@playwright/test";

/**
 * Two-tab huddle join is labs. REALTIME_SFU_* lives in production only.
 * Do not mint fake SFU credentials locally; keep this skipped in the campaign.
 */
test.describe("huddles two-tab (labs)", () => {
  test.skip(true, "SFU secrets stay in prod — skip two-tab huddles in local campaign");

  test("placeholder — hosted SFU only", async () => {
    test.skip(true, "Join/leave + mute across two tabs is out of local E2E");
  });
});
