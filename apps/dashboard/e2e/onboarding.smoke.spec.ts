import { test, expect } from "@playwright/test";

/**
 * UI smoke: no worker required. Skips when Clerk hosted auth is enabled (manual JWT UI hidden).
 */
test.describe("onboarding smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      {
        name: "fc_console_ack",
        value: "1",
        url: "http://127.0.0.1:3000",
      },
    ]);
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
  });

  test("shows quickstart wizard and step rail", async ({ page }) => {
    await expect(page.getByTestId("onboarding-page")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Quickstart wizard" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Onboarding steps" })).toBeVisible();
    await expect(page.getByText("Step 1 of")).toBeVisible();
  });

  test("manual JWT path advances to create project", async ({ page }) => {
    const jwtInput = page.getByTestId("admin-jwt-input");
    test.skip((await jwtInput.count()) === 0, "Clerk hosted auth — manual JWT step not shown");

    await jwtInput.fill("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e2e-smoke");
    await page.getByTestId("connect-continue").click();
    await expect(page.getByRole("heading", { name: "Create project" })).toBeVisible();
  });
});
