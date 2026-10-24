import { test, expect, type BrowserContext } from "@playwright/test";

async function ackConsole(context: BrowserContext) {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
  await context.addCookies([{ name: "fc_console_ack", value: "1", url: base }]);
}

test.describe("moderation smoke", () => {
  test.beforeEach(async ({ context }) => {
    await ackConsole(context);
  });

  test("renders moderation dashboard", async ({ page }) => {
    const response = await page.goto("/moderation", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Moderation" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /Escalation queue/ })).toBeVisible();
  });
});
