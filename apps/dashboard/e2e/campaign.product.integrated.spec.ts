import { expect, test } from "@playwright/test";
import { ackConsole, isWorkerGet, seedAdminSession, skipWithoutAdminJwt } from "./helpers";

/**
 * Phase 6 remainder: beta/kernel product pages hit the live Worker with a minted JWT.
 * Huddles two-tab is not in this file (SFU secrets stay in prod).
 */
test.describe("campaign product integrated", () => {
  test.beforeEach(async ({ context, page }) => {
    const adminJwt = skipWithoutAdminJwt();
    await ackConsole(context);
    await seedAdminSession(page, adminJwt);
  });

  test("projects GET 200 and hides the paste-JWT load copy", async ({ page }) => {
    const list = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/admin/projects") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/projects", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Projects", exact: true, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    expect((await list).status()).toBe(200);
    await expect(page.getByText("Paste an admin JWT under Session settings to load projects.")).toHaveCount(0);
  });

  test("collab lists rooms via GET /rooms and hides the sign-in gate", async ({ page }) => {
    const list = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/rooms") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/collab", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "FluxyCollab" })).toBeVisible({ timeout: 20_000 });
    expect((await list).status()).toBe(200);
    await expect(page.getByText("Sign in with your project JWT")).toHaveCount(0);
  });

  test("fleet GET vehicles 200 and hides the connect copy", async ({ page }) => {
    const vehicles = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/fleet/vehicles") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/fleet", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Fleet Tracking" })).toBeVisible({ timeout: 20_000 });
    expect((await vehicles).status()).toBe(200);
    await expect(page.getByText("Connect a project session to use Fleet Tracking.")).toHaveCount(0);
  });

  test("iot GET devices 200 and hides the admin JWT gate", async ({ page }) => {
    const devices = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/iot/devices") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/iot", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "IoT", exact: true, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    expect((await devices).status()).toBe(200);
    await expect(page.getByText("Admin JWT required.")).toHaveCount(0);
  });

  test("webhooks GET summary 200 and hides the Quickstart mint copy", async ({ page }) => {
    const summary = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/admin/webhooks/summary") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/webhooks", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Webhooks", exact: true, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    expect((await summary).status()).toBe(200);
    await expect(page.getByText("Mint an admin JWT in Quickstart to manage webhooks.")).toHaveCount(0);
  });

  test("notifications GET 200", async ({ page }) => {
    const feed = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/notifications") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/notifications", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Notifications", exact: true, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    expect((await feed).status()).toBe(200);
  });

  test("embed GET config 200", async ({ page }) => {
    const config = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/admin/embed-config") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/embed", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Embed widget" })).toBeVisible({ timeout: 20_000 });
    expect((await config).status()).toBe(200);
  });

  test("llm-keys GET catalog 200 and hides JWT gate", async ({ page }) => {
    const catalog = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/llm/providers") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/agents/llm-keys", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Agents", exact: true, level: 1 })).toBeVisible({
      timeout: 20_000,
    });
    expect((await catalog).status()).toBe(200);
    await expect(page.getByText("Admin JWT required to configure LLM keys.")).toHaveCount(0);
  });

  test("a2a GET agent-cards 200", async ({ page }) => {
    const cards = page.waitForResponse(
      (res) => isWorkerGet(res.url(), "/a2a/agent-cards") && res.request().method() === "GET",
      { timeout: 45_000 },
    );
    await page.goto("/agents/a2a", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "A2A protocol" })).toBeVisible({ timeout: 20_000 });
    expect((await cards).status()).toBe(200);
  });
});
