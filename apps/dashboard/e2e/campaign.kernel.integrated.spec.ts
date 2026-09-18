import { expect, test } from "@playwright/test";
import { ackConsole, isWorkerGet, seedAdminSession, skipWithoutAdminJwt } from "./helpers";

/**
 * Campaign: product pages hit the live Worker with a real admin JWT.
 * JWT is minted in globalSetup (E2E_ADMIN_JWT or local /dev/provision).
 */
test.describe("campaign kernel integrated", () => {
  test.beforeEach(async ({ context, page }) => {
    const adminJwt = skipWithoutAdminJwt();
    await ackConsole(context);
    await seedAdminSession(page, adminJwt);
  });

  test("rooms list GET 200 and hides the no-session empty state", async ({ page }) => {
    const list = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/rooms") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/rooms", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Rooms", exact: true, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    const res = await list;
    expect(res.status()).toBe(200);
    await expect(page.getByText("Connect a session")).toHaveCount(0);
  });

  test("inbox GET 200 and shows items count", async ({ page }) => {
    const feed = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/inbox") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/inbox", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Inbox", exact: true, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    const res = await feed;
    expect(res.status()).toBe(200);
    await expect(page.getByTestId("inbox-items-count")).toBeVisible({ timeout: 45_000 });
  });

  test("agents GET 200 and sidebar is present", async ({ page }) => {
    const list = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/agents") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/agents", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Agents", exact: true, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    const res = await list;
    expect(res.status()).toBe(200);
    await expect(page.getByLabel("Agents sidebar")).toBeVisible();
  });
});
