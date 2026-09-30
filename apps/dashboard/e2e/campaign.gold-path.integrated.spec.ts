import { expect, test } from "@playwright/test";
import { ackConsole, isWorkerGet, seedAdminSession, skipWithoutAdminJwt } from "./helpers";

/**
 * First-run path: JWT from globalSetup (/dev/provision + /auth/token),
 * rooms list, inbox. Agent invoke + HITL POST + mid-stream refresh need a live
 * room fixture; they stay skipped until that fixture exists.
 */
test.describe("campaign gold path", () => {
  test.beforeEach(async ({ context, page }) => {
    const adminJwt = skipWithoutAdminJwt();
    await ackConsole(context);
    await seedAdminSession(page, adminJwt);
  });

  test("health, rooms, and inbox respond", async ({ page }) => {
    const rooms = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/rooms") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/rooms", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Rooms", exact: true, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    expect((await rooms).status()).toBe(200);

    const inbox = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/inbox") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/inbox", { waitUntil: "domcontentloaded" });
    expect((await inbox).status()).toBe(200);
  });
});
