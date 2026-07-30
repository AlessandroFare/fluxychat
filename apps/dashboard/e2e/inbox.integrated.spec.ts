import { test, expect } from "@playwright/test";

const adminJwt = process.env.E2E_ADMIN_JWT?.trim() ?? "";

/**
 * Inbox console: REST feed + live item UI wired to useInbox({ onItem }).
 *
 * Local integrated:
 *   E2E_ADMIN_JWT=... pnpm test:e2e:integrated -- inbox.integrated
 */
test.describe("inbox integrated", () => {
  test.skip(!adminJwt, "Set E2E_ADMIN_JWT to run integrated inbox E2E");

  test("loads inbox with items feed after session connect", async ({ page }) => {
    await page.goto("/onboarding");

    const jwtInput = page.getByTestId("admin-jwt-input");
    test.skip((await jwtInput.count()) === 0, "Clerk hosted auth — use self-hosted dashboard for this test");

    await jwtInput.fill(adminJwt);
    await page.getByTestId("connect-continue").click();

    const createProject = page.getByTestId("create-project-btn");
    if (await createProject.isVisible()) {
      await page.getByTestId("project-name-input").fill(`Inbox E2E ${Date.now()}`);
      await createProject.click();
      await expect(page.getByTestId("project-continue")).toBeEnabled({ timeout: 60_000 });
    }
    await page.getByTestId("project-continue").click();

    await page.getByTestId("mint-jwt-btn").click();
    await expect(page.getByTestId("mint-continue")).toBeEnabled({ timeout: 60_000 });
    await page.getByTestId("mint-continue").click();

    await page.goto("/inbox");

    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("inbox-items-count")).toBeVisible({ timeout: 45_000 });
  });
});
