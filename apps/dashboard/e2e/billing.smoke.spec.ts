import { test, expect } from "@playwright/test";

test.describe("billing smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      {
        name: "fc_console_ack",
        value: "1",
        url: "http://127.0.0.1:3000",
      },
    ]);
    await page.goto("/billing", { waitUntil: "domcontentloaded" });
  });

  test("shows billing console and disabled load without session", async ({ page }) => {
    await expect(page.getByTestId("billing-page")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Billing & usage" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Load plan and usage" })).toBeVisible();
    await expect(page.getByTestId("billing-load-btn")).toBeDisabled();
  });
});
