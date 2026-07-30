import { test, expect } from "@playwright/test";

/**
 * PL-18 smoke slice: onboarding UI, inbox shell, weak network — no worker/JWT required.
 * Integrated send + reconnect: portal-parity.integrated.spec.ts
 */
test.describe("portal parity smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      { name: "fc_console_ack", value: "1", url: "http://127.0.0.1:3000" },
    ]);
  });

  test("onboarding playground renders under slow network", async ({ page, context }) => {
    await context.route("**/*", async (route) => {
      await new Promise((r) => setTimeout(r, 120));
      await route.continue();
    });

    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("onboarding-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("onboarding-playground")).toBeVisible();
  });

  test("inbox page shell loads without integrated session", async ({ page }) => {
    await page.goto("/inbox", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({ timeout: 20_000 });
  });

  test("recovers after brief offline on onboarding", async ({ page, context }) => {
    await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("onboarding-page")).toBeVisible({ timeout: 20_000 });

    await context.setOffline(true);
    await expect(page.getByTestId("onboarding-page")).toBeVisible();
    await context.setOffline(false);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("onboarding-progress")).toBeVisible({ timeout: 20_000 });
  });
});
