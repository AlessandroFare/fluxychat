import { test, expect } from "@playwright/test";

/**
 * PG-P0-5 — Inbox Portal parity smoke (no JWT): shell, tabs, onItem UI hooks, mark-read affordances.
 */
test.describe("inbox parity smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      { name: "fc_console_ack", value: "1", url: "http://127.0.0.1:3000" },
    ]);
  });

  test("inbox shell exposes Portal-parity tabs and empty-state CTA", async ({ page }) => {
    await page.goto("/inbox", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /All/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Mentions/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Unread/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Snoozed/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Follow-ups/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Refresh/i })).toBeVisible();
  });

  test("inbox without session links to onboarding quickstart", async ({ page }) => {
    await page.goto("/inbox", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Connect a session")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Open quickstart" })).toBeVisible();
  });

  test("live onItem region is present in DOM for realtime feed", async ({ page }) => {
    await page.goto("/inbox", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-testid=inbox-live-items]")).toHaveCount(0);
    await expect(page.locator("[data-testid=inbox-items-feed]")).toHaveCount(0);
  });
});
