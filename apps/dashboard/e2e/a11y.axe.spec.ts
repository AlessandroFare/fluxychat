/**
 * Audit D  axe-core a11y suite for FluxyChat dashboard.
 *
 * Public, auth-free pages: landing, why, compare, get-started, docs, enter,
 * plus the W6 public utilities (guides index + one guide rep, incident, report).
 * Auth-gated console routes are covered by `a11y.admin.integrated.spec.ts`
 * (requires E2E_ADMIN_JWT).
 *
 * W5 (Oct 2026): the warm-light contrast pass and the landmark-unique fix
 * ("M12  A11y contrast pass" in ROADMAP_EXECUTION.md) are done — these pages
 * are green. If a contrast finding reappears here, remember the hero WebGL
 * backdrop is invisible to axe (headless, GPU disabled): the glass bands are
 * intentionally self-sufficient (alpha 0.92) so the reported colours come
 * from the fixed fallbacks, not the canvas.
 *
 * Gallery: landing `/` includes `#build-gallery` (mock previews).
 * Live Vite `--example` apps and docs MDX gallery are not in this file.
 * Honest VPAT notes: docs/operations/accessibility-conformance.
 *
 * Blocking impact levels: Critical, Serious, Moderate. Minor
 * (best-practice) violations are logged but do not fail the test.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Sample the reduced-motion configuration: infinite decorative pulses
// (`animate-pulse` on text wrong-footed axe mid-swing once — collab
// "Explore all" pill sampled at ~56% opacity, 3.77:1). With prefers-reduced-
// motion the pulsing text stops (motion-reduce:animate-none) and entrance
// animations are skipped, so sampled colors are deterministic.
test.use({ reducedMotion: "reduce" });

const PUBLIC_PAGES = [
  { name: "landing", path: "/" },
  { name: "why", path: "/why" },
  { name: "compare", path: "/compare" },
  { name: "get-started", path: "/get-started" },
  { name: "docs", path: "/docs" },
  { name: "enter", path: "/enter" },
  // W6: guides + public utilities (share is dynamic/worker-fed, kept out).
  { name: "guides", path: "/guides" },
  { name: "guide-jwt-auth", path: "/guides/jwt-auth" },
  { name: "incident", path: "/incident" },
  { name: "report", path: "/report" },
];

// Onboarding steps: covered by e2e/onboarding.smoke.spec.ts. `?step=N` is not
// a supported deep link, so the old ONBOARDING_STEPS paths are gone on purpose.

const BLOCKING_IMPACTS = ["critical", "serious", "moderate"] as const;

async function attachConsoleAckCookie(context: import("@playwright/test").BrowserContext) {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
  await context.addCookies([
    { name: "fc_console_ack", value: "1", url: base },
  ]);
}

function logViolations(prefix: string, violations: import("axe-core").Result[]) {
  for (const v of violations) {
    const nodeCount = v.nodes.length;
    const firstNode = v.nodes[0]?.target?.join(" ") ?? "(no selector)";
    const html = v.nodes[0]?.html?.slice(0, 200) ?? "(no html)";
    console.log(
      `[a11y] ${prefix} ${v.impact ?? "unknown"} ${v.id}: ${v.help} (${nodeCount} node(s); first: ${firstNode}) html=${html}`,
    );
  }
}

test.describe("axe a11y  public pages", () => {
  for (const p of PUBLIC_PAGES) {
    test(`${p.name} has no Critical/Serious/Moderate violations`, async ({ page, context }) => {
      await attachConsoleAckCookie(context);
      const response = await page.goto(p.path, { waitUntil: "load" });
      if (!response || response.status() >= 400) {
        test.skip(true, `page returned ${response?.status() ?? "no response"}`);
      }
      // Wait for React hydration to settle.
      await page.waitForTimeout(1500);
      const results = await new AxeBuilder({ page })
        // Skip iframes  Clerk + Sentry wrappers mount their own
        // cross-origin iframes whose bootstrap shell legitimately
        // lacks <html lang> / <title> / <main> / <h1>.
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
