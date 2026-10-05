import { test, expect } from "@playwright/test";

test.describe("landing smoke", () => {
  test("renders hero and server pricing section", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("MIT on your Cloudflare account")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Humans and agents", {
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Free" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Starter" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pro" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "One room, humans and an agent" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Shared AI room/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Agent war room/i })).toBeVisible();
    await expect(page.getByText("Undercuts Pusher")).toHaveCount(0);
    await expect(page.getByText("First-class live cursors")).toHaveCount(0);
    await expect(page.getByText("Tool approvals")).toBeVisible();
    await expect(page.getByRole("heading", { name: "How we compare" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "A room other organisations can join" }),
    ).toBeVisible();
  });

  test("labs uses one header", async ({ page }) => {
    await page.goto("/labs", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Off the main nav", {
      timeout: 15_000,
    });
    await expect(page.getByRole("banner")).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Live cursors/i })).toBeVisible();
  });
});
