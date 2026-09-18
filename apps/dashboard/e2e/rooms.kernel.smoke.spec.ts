import { expect, test } from "@playwright/test";

test.describe("rooms kernel smoke", () => {
  test.beforeEach(async ({ context }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
    await context.addCookies([{ name: "fc_console_ack", value: "1", url: base }]);
  });

  test("without a JWT the empty list tells you to connect a session", async ({ page }) => {
    await page.goto("/rooms", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Connect a session")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Paste a member or admin JWT from Projects/)).toBeVisible();
  });
});
