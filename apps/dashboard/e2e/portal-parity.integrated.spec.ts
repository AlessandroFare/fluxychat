import { test, expect } from "@playwright/test";
import { sendSampleAndWaitForEcho } from "./helpers";

const adminJwt = process.env.E2E_ADMIN_JWT?.trim() ?? "";

/**
 * PL-18 integrated: onboarding → send → inbox → offline/reconnect.
 *
 *   E2E_ADMIN_JWT=... pnpm test:e2e:integrated -- portal-parity.integrated
 */
test.describe("portal parity integrated", () => {
  test.skip(!adminJwt, "Set E2E_ADMIN_JWT to run integrated portal parity E2E");

  async function completeOnboardingToFirstMessage(page: import("@playwright/test").Page, roomId: string) {
    await page.goto("/onboarding");

    const jwtInput = page.getByTestId("admin-jwt-input");
    test.skip((await jwtInput.count()) === 0, "Clerk hosted auth — use self-hosted dashboard");

    await jwtInput.fill(adminJwt);
    await page.getByTestId("connect-continue").click();

    const createProject = page.getByTestId("create-project-btn");
    if (await createProject.isVisible()) {
      await page.getByTestId("project-name-input").fill(`Portal ${roomId}`);
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
  }

  test("onboarding → send → inbox feed", async ({ page }) => {
    const roomId = `portal-${Date.now()}`;
    await completeOnboardingToFirstMessage(page, roomId);

    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("inbox-items-count")).toBeVisible({ timeout: 45_000 });
  });

  test("survives brief offline during chat step", async ({ page, context }) => {
    const roomId = `offline-${Date.now()}`;
    await page.goto("/onboarding");

    const jwtInput = page.getByTestId("admin-jwt-input");
    test.skip((await jwtInput.count()) === 0, "Clerk hosted auth");

    await jwtInput.fill(adminJwt);
    await page.getByTestId("connect-continue").click();
    await page.getByTestId("project-continue").click({ timeout: 60_000 }).catch(() => {});
    if (await page.getByTestId("create-project-btn").isVisible()) {
      await page.getByTestId("project-name-input").fill(`Offline ${roomId}`);
      await page.getByTestId("create-project-btn").click();
    }
    await expect(page.getByTestId("project-continue")).toBeEnabled({ timeout: 60_000 });
    await page.getByTestId("project-continue").click();
    await page.getByTestId("mint-jwt-btn").click();
    await expect(page.getByTestId("mint-continue")).toBeEnabled({ timeout: 60_000 });
    await page.getByTestId("mint-continue").click();
    await page.getByTestId("room-id-input").fill(roomId);
    await page.getByTestId("create-room-btn").click();
    await page.getByTestId("room-continue").click();

    await context.setOffline(true);
    await page.waitForTimeout(500);
    await context.setOffline(false);

    await sendSampleAndWaitForEcho(page, "alice");
  });
});
