import { test, expect } from "@playwright/test";

test.describe("moderation smoke", () => {
  test("renders moderation dashboard", async ({ page }) => {
    const response = await page.goto("/moderation", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Moderation" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Escalation queue")).toBeVisible();
  });
});
