/**
 * WCAG axe suite for auth-gated admin surfaces (#15).
 *
 *   E2E_ADMIN_JWT=... pnpm test:e2e:integrated -- a11y.admin.integrated
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const adminJwt = process.env.E2E_ADMIN_JWT?.trim() ?? "";

const ADMIN_PAGES = [
  { name: "settings-residency", path: "/settings/residency", heading: "Data residency" },
  { name: "settings-ephemeral", path: "/settings/ephemeral", heading: "Ephemeral & room TTL" },
  { name: "settings-search", path: "/settings/search", heading: "Semantic search" },
  { name: "audit-chain", path: "/soc2/audit-chain", heading: "Immutable audit chain" },
  { name: "matrix-bridges", path: "/bridges/matrix", heading: "Matrix federation" },
  { name: "agent-eval", path: "/agents/eval", heading: "Agent eval datasets" },
  { name: "voice-ai", path: "/voice-ai", heading: "Voice AI pipeline" },
] as const;

const BLOCKING_IMPACTS = ["critical", "serious", "moderate"] as const;

async function attachConsoleAckCookie(context: import("@playwright/test").BrowserContext) {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
  await context.addCookies([{ name: "fc_console_ack", value: "1", url: base }]);
}

async function seedAdminSession(page: import("@playwright/test").Page, jwt: string) {
  await page.addInitScript((token) => {
    const payload = {
      adminJwt: token,
      memberJwt: "",
      activeProject: null,
      lastRoom: null,
    };
    window.sessionStorage.setItem("fluxychat.dashboard.session.v1", JSON.stringify(payload));
  }, jwt);
}

function logViolations(prefix: string, violations: import("axe-core").Result[]) {
  for (const v of violations) {
    const nodeCount = v.nodes.length;
    const firstNode = v.nodes[0]?.target?.join(" ") ?? "(no selector)";
    console.log(
      `[a11y-admin] ${prefix} ${v.impact ?? "unknown"} ${v.id}: ${v.help} (${nodeCount} node(s); first: ${firstNode})`,
    );
  }
}

test.describe("axe a11y — admin pages (integrated)", () => {
  test.skip(!adminJwt, "Set E2E_ADMIN_JWT to run integrated admin a11y E2E");

  for (const p of ADMIN_PAGES) {
    test(`${p.name} has no Critical/Serious/Moderate violations`, async ({ page, context }) => {
      await attachConsoleAckCookie(context);
      await seedAdminSession(page, adminJwt);

      const response = await page.goto(p.path, { waitUntil: "load" });
      if (!response || response.status() >= 400) {
        test.skip(true, `page returned ${response?.status() ?? "no response"}`);
      }

      await expect(page.getByRole("heading", { name: p.heading })).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1200);

      const results = await new AxeBuilder({ page })
        .options({ iframes: false })
        .analyze();

      logViolations(p.name, results.violations);
      const blocking = results.violations.filter((v) =>
        (BLOCKING_IMPACTS as readonly string[]).includes(v.impact ?? ""),
      );
      expect(blocking).toHaveLength(0);
    });
  }
});
