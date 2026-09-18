import { expect, test } from "@playwright/test";
import { ackConsole, isWorkerGet, seedAdminSession, skipWithoutAdminJwt } from "./helpers";

/**
 * Agents list against a live Worker.
 *
 *   pnpm test:e2e:integrated -- agents.integrated
 */
test.describe("agents integrated", () => {
  test("lists agents after seeding an admin session", async ({ page, context }) => {
    const adminJwt = skipWithoutAdminJwt();
    await ackConsole(context);
    await seedAdminSession(page, adminJwt);

    const list = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/agents") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/agents", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Agents", exact: true, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    const res = await list;
    expect(res.status()).toBe(200);
    await expect(page.getByLabel("Agents sidebar")).toBeVisible();
  });
});
