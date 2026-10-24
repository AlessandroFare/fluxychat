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

  test("shows quickstart playground and progress strip", async ({ page }) => {
    await expect(page.getByTestId("onboarding-page")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await expect(page.getByRole("button", { name: "Project" })).toBeVisible();
    await expect(page.getByTestId("onboarding-playground")).toBeVisible();
    await expect(page.getByTestId("onboarding-progress")).toBeVisible();
  });

  test("welcome step names a way in that actually resolves", async ({ page }) => {
    const hostedNote = page.getByText(/Next step asks you to sign in/i);
    const skipLink = page.getByRole("link", { name: /skip ahead to the console/i });
    // Hosted: sign-in is the only door. Self-host: the skip points at a reachable route.
    await expect(hostedNote.or(skipLink)).toBeVisible({ timeout: 15_000 });
    if ((await skipLink.count()) > 0) {
      await expect(skipLink).toHaveAttribute("href", "/dashboard");
    }
  });

  test("manual JWT path unlocks create project", async ({ page }) => {
    const jwtInput = page.getByTestId("admin-jwt-input");
    test.skip((await jwtInput.count()) === 0, "Clerk hosted auth — manual JWT step not shown");

    // Filling the JWT is what reveals the project section; the old Continue button is gone.
    // Retry the fill: if it lands before React hydration, the controlled input resets it.
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e2e-smoke";
    await expect
      .poll(
        async () => {
          await jwtInput.fill(token);
          return page
            .getByTestId("create-project-btn")
            .isVisible()
            .catch(() => false);
        },
        { message: "JWT fill should stick once the page is hydrated" },
      )
      .toBe(true);

    await expect(page.getByTestId("project-name-input")).toBeEnabled();
  });
});

