import { test, expect } from "@playwright/test";

/** PL-16 — embed config page loads (no worker save required). */
test.describe("embed widget smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      { name: "fc_console_ack", value: "1", url: "http://127.0.0.1:3000" },
    ]);
  });

  test("embed widget console page renders", async ({ page }) => {
    await page.goto("/embed", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Embed widget" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Configuration")).toBeVisible();
    await expect(page.getByText("Install snippet")).toBeVisible();
  });
});
