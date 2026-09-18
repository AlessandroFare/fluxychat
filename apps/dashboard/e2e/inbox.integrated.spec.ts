import { expect, test } from "@playwright/test";
import { ackConsole, isWorkerGet, seedAdminSession, skipWithoutAdminJwt } from "./helpers";

/**
 * Inbox console: REST feed wired to useInbox.
 *
 *   pnpm test:e2e:integrated -- inbox.integrated
 */
test.describe("inbox integrated", () => {
  test("loads inbox with items feed after session connect", async ({ page, context }) => {
    const adminJwt = skipWithoutAdminJwt();
    await ackConsole(context);
    await seedAdminSession(page, adminJwt);

    const feed = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/inbox") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/inbox", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Inbox", exact: true, level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    const res = await feed;
    expect(res.status()).toBe(200);
    await expect(page.getByTestId("inbox-items-count")).toBeVisible({ timeout: 45_000 });
  });
});
