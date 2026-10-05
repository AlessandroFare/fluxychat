import { test, expect } from "@playwright/test";

test.describe("DSA report page", () => {
  test("renders the public notice form", async ({ page }) => {
    await page.goto("/report", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Report illegal content", {
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Submit notice" })).toBeVisible();
  });
});
