import { test, expect } from "@playwright/test";

test.describe("landing smoke", () => {
  test("renders hero and server pricing section", async ({ page }) => {
    await page.goto("/landing", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ship in-app chat", {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "How we compare" })).toBeVisible();
  });
});
