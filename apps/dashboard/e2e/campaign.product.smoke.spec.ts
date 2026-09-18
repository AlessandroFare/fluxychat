import { expect, test, type BrowserContext } from "@playwright/test";

async function ackConsole(context: BrowserContext) {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
  await context.addCookies([{ name: "fc_console_ack", value: "1", url: base }]);
}

test.describe("campaign product smoke (no JWT)", () => {
  test.beforeEach(async ({ context }) => {
    await ackConsole(context);
  });

  test("rooms empty state asks you to paste a JWT", async ({ page }) => {
    await page.goto("/rooms", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Connect a session")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Paste a member or admin JWT from Projects/)).toBeVisible();
  });

  test("projects load path asks for an admin JWT", async ({ page }) => {
    await page.goto("/projects", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Projects", exact: true, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Paste an admin JWT under Session settings to load projects.")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("agents console surfaces the admin JWT gate", async ({ page }) => {
    await page.goto("/agents", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Agents", exact: true, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Admin JWT required\. Configure session in Projects/)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("collab without a session tells you to sign in with a project JWT", async ({ page }) => {
    await page.goto("/collab", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Sign in with your project JWT")).toBeVisible({ timeout: 20_000 });
  });

  test("fleet without a session asks you to connect", async ({ page }) => {
    await page.goto("/fleet", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Connect a project session to use Fleet Tracking.")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("iot without a session asks for admin JWT", async ({ page }) => {
    await page.goto("/iot", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Admin JWT required.")).toBeVisible({ timeout: 20_000 });
  });

  test("webhooks without a session points at Quickstart", async ({ page }) => {
    await page.goto("/webhooks", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Mint an admin JWT in Quickstart to manage webhooks.")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("huddles is labs and JWT-gated; camera stays off without REALTIME_SFU_ALLOW_VIDEO", async ({
    page,
  }) => {
    await page.goto("/huddles", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Huddles" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Admin JWT required\. Copy one from/)).toBeVisible();
    await expect(page.getByText(/REALTIME_SFU_ALLOW_VIDEO=true/)).toBeVisible();
  });
});
