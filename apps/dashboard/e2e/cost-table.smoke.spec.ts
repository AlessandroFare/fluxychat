import { test, expect } from "@playwright/test";

/**
 * Cost table smoke  confirms the new CloudflareCostTable renders on the
 * two highest-traffic pages and shows the three plan rows.
 *
 * CI runs *.smoke.spec.ts; non-smoke specs run only in local dev.
 */
test.describe("cloudflare cost table", () => {
  test("renders on /landing with three plan rows", async ({ page }) => {
    await page.goto("/landing", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "What does it actually cost on Cloudflare?" }),
    ).toBeVisible({ timeout: 15_000 });

    const section = page.locator("#cloudflare-cost");
    await expect(section).toBeVisible();
    // Three plan rows (header + 3 body rows = 4 <tr>).
    const rowCount = await section.locator("tbody tr").count();
    expect(rowCount).toBe(3);

    // Spot-check each plan label is present.
    await expect(section.getByText("Workers Free", { exact: false })).toBeVisible();
    await expect(
      section.getByText("Workers Paid ($5/mo)", { exact: false }),
    ).toBeVisible();
    await expect(
      section.getByText("Self-host on your CF account", { exact: false }),
    ).toBeVisible();
  });

  test("renders on /compare under the DIY table", async ({ page }) => {
    await page.goto("/compare", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Running costs on Cloudflare" }),
    ).toBeVisible({ timeout: 15_000 });

    // Find the table that contains "Workers Free"  should be 3 body rows.
    const costHeading = page.getByRole("heading", { name: "Running costs on Cloudflare" });
    const sectionRoot = costHeading.locator("xpath=ancestor::div[1]");
    const tableRows = sectionRoot.locator("tbody tr");
    await expect(tableRows).toHaveCount(3);
  });
});
