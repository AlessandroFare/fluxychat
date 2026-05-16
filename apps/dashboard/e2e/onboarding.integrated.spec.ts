import { test, expect } from "@playwright/test";
import { sendSampleAndWaitForEcho } from "./helpers";

const adminJwt = process.env.E2E_ADMIN_JWT?.trim() ?? "";

/**
 * Full self-hosted path: dashboard + worker must be reachable.
 *
 * Local (auto-starts worker + dashboard):
 *   E2E_ADMIN_JWT=... pnpm test:e2e:integrated
 *
 * Manual servers:
 *   PLAYWRIGHT_SKIP_WEBSERVER=1 E2E_ADMIN_JWT=... pnpm test:e2e:integrated
 */
test.describe("onboarding integrated", () => {
  test.skip(!adminJwt, "Set E2E_ADMIN_JWT to run integrated onboarding E2E");

  test("connect → project → member JWT → room → first message", async ({ page }) => {
    const roomId = `e2e-${Date.now()}`;

    await page.goto("/onboarding");

    const jwtInput = page.getByTestId("admin-jwt-input");
    test.skip((await jwtInput.count()) === 0, "Clerk hosted auth — use self-hosted dashboard for this test");

    await jwtInput.fill(adminJwt);
    await page.getByTestId("connect-continue").click();

    const createProject = page.getByTestId("create-project-btn");
    if (await createProject.isVisible()) {
      await page.getByTestId("project-name-input").fill(`E2E ${roomId}`);
      await createProject.click();
      await expect(page.getByTestId("project-continue")).toBeEnabled({ timeout: 60_000 });
    }
    await page.getByTestId("project-continue").click();

    await page.getByTestId("mint-jwt-btn").click();
    await expect(page.getByTestId("mint-continue")).toBeEnabled({ timeout: 60_000 });
    await page.getByTestId("mint-continue").click();

    await page.getByTestId("room-id-input").fill(roomId);
    await page.getByTestId("create-room-btn").click();
    await expect(page.getByText("Active room:")).toContainText(roomId, { timeout: 60_000 });
    await page.getByTestId("room-continue").click();

    await expect(page.getByRole("heading", { name: "First message" })).toBeVisible();
    await sendSampleAndWaitForEcho(page, "alice");
  });
});
