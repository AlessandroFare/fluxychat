import { test, expect } from "@playwright/test";

test.describe("status smoke", () => {
  test("renders public status page", async ({ page }) => {
    await page.goto("/status", { waitUntil: "networkidle", timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "System status" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "Chat API" })).toBeVisible();
  });
});
