import { test, expect } from "@playwright/test";

test.describe("status smoke", () => {
  test("renders public status page", async ({ page }) => {
    const response = await page.goto("/status", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-testid="status-heading"]:visible')).toContainText("System status", {
      timeout: 10_000,
    });
    await expect(page.getByText("Chat API").filter({ visible: true }).first()).toBeVisible();
  });
});
