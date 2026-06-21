import { test, expect } from "@playwright/test";

test.describe("status smoke", () => {
  test("renders public status page", async ({ page }) => {
    await page.goto("/status", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("status-heading")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Chat API" })).toBeVisible();
  });
});
