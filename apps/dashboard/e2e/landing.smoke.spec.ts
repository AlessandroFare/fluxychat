import { test, expect } from "@playwright/test";

test.describe("landing smoke", () => {
  test("renders hero and server pricing section", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("One room, one machine", {
      timeout: 15_000,
    });
    await expect(page.getByText(/MIT when you want it on your own account/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "The room is the unit." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Three rooms teams build first." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Incident room" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Free until the rooms get busy." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Free", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Starter", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Straight answers." })).toBeVisible();
    await expect(page.getByTestId("cloudflare-cost-table")).toBeVisible();
    await expect(page.getByText("Undercuts Pusher")).toHaveCount(0);
    await expect(page.getByText("First-class live cursors")).toHaveCount(0);
  });

  test("labs uses one header", async ({ page }) => {
    await page.goto("/labs", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Still labs on purpose", {
      timeout: 15_000,
    });
    // One header in the DOM (MarketingShell's). The root layout nests pages in <main>,
    // so the implicit ARIA "banner" role is not exposed — count the element instead.
    await expect(page.locator("header")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "A lab is a prototype with a door." })).toBeVisible();
  });

  test("labs deep-links the worker verticals", async ({ page }) => {
    await page.goto("/labs", { waitUntil: "domcontentloaded" });
    const section = page.locator("section", {
      has: page.getByRole("heading", { name: "These already run on your Worker" }),
    });
    await expect(section).toBeVisible({ timeout: 15_000 });
    for (const [label, href] of [
      [/FluxyStream/i, "/stream"],
      [/FluxyGame/i, "/game"],
      [/FluxyIoT/i, "/iot"],
      [/Fleet/i, "/fleet"],
    ] as const) {
      await expect(section.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  });
});
