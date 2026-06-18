import { test, expect } from "@playwright/test";

const adminJwt = process.env.E2E_ADMIN_JWT?.trim() ?? "";

test.describe("billing integrated", () => {
  test.skip(!adminJwt, "Set E2E_ADMIN_JWT to run integrated billing E2E");

  test("loads plan from worker with admin JWT", async ({ page }) => {
    await page.context().addCookies([
      {
        name: "fc_console_ack",
        value: "1",
        url: "http://127.0.0.1:3000",
      },
    ]);

    await page.goto("/onboarding");
    const jwtInput = page.getByTestId("admin-jwt-input");
    test.skip((await jwtInput.count()) === 0, "Clerk hosted auth — use self-hosted dashboard for this test");

    await jwtInput.fill(adminJwt);
    await page.getByTestId("connect-continue").click();

    const createProject = page.getByTestId("create-project-btn");
    if (await createProject.isVisible()) {
      await page.getByTestId("project-name-input").fill(`Billing E2E ${Date.now()}`);
      await createProject.click();
      await expect(page.getByTestId("project-continue")).toBeEnabled({ timeout: 60_000 });
      await page.getByTestId("project-continue").click();
    }

    await page.goto("/billing");
    await expect(page.getByTestId("billing-page")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("billing-load-btn").click();
    await expect(page.getByText("Current Plan")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Free")).toBeVisible();
  });
});

