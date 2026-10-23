/**
 * Craft-program baseline screenshots (local tool; skipped on CI).
 *
 * Usage (from apps/dashboard):
 *   $env:CRAFT_SHOT_LABEL="before"; $env:PLAYWRIGHT_CHANNEL="chrome"
 *   pnpm exec playwright test -c playwright.integrated.config.ts e2e/craft-baseline.integrated.spec.ts
 *
 * Boots the integrated harness (wrangler dev + next dev) and writes full-page PNGs to
 * docs/research/craft-baseline/<label>/ (gitignored). Re-run with CRAFT_SHOT_LABEL=after
 * at the end of each wave.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, type Page, type ViewportSize } from "@playwright/test";
import { seedAdminSession, skipWithoutAdminJwt } from "./helpers";

const LABEL = process.env.CRAFT_SHOT_LABEL?.trim() || "before";
const OUT = join(process.cwd(), "..", "..", "docs", "research", "craft-baseline", LABEL);

const DESKTOP: ViewportSize = { width: 1440, height: 900 };
const MOBILE: ViewportSize = { width: 390, height: 844 };

const CONSOLE_PAGES: Array<[string, string]> = [
  ["dashboard", "/dashboard"],
  ["rooms", "/rooms"],
  ["inbox", "/inbox"],
  ["agents", "/agents"],
  ["agents-eval", "/agents/eval"],
  ["agents-platform", "/agents/platform"],
  ["truth-market", "/truth-market"],
  ["settings", "/settings"],
  ["settings-status", "/settings/status"],
  ["settings-integrations", "/settings/integrations"],
  ["settings-retention", "/settings/retention"],
  ["settings-mcp", "/settings/mcp"],
  ["settings-identity", "/settings/identity"],
  ["settings-media", "/settings/media"],
  ["settings-usage", "/settings/usage"],
  ["settings-agent-tools", "/settings/agent-tools"],
  ["settings-commands", "/settings/commands"],
  ["settings-consent", "/settings/consent"],
  ["settings-crm", "/settings/crm"],
  ["settings-dlp", "/settings/dlp"],
  ["settings-e2e", "/settings/e2e"],
  ["settings-ephemeral", "/settings/ephemeral"],
  ["settings-firmware", "/settings/firmware"],
  ["settings-hipaa", "/settings/hipaa"],
  ["settings-push", "/settings/push"],
  ["settings-residency", "/settings/residency"],
  ["settings-search", "/settings/search"],
  ["settings-support", "/settings/support"],
  ["settings-telephony", "/settings/telephony"],
  ["settings-translation", "/settings/translation"],
  ["billing", "/billing"],
  ["analytics", "/analytics"],
  ["activities", "/activities"],
  ["onboarding", "/onboarding"],
  ["threads", "/threads"],
  ["not-found", "/no-such-page-404"],
  ["not-found-console", "/dashboard/no-such-page-404"],
];

const MARKETING_PAGES: Array<[string, string]> = [
  ["home", "/"],
  ["pricing", "/pricing"],
  ["compare-sendbird", "/compare/sendbird"],
  ["why", "/why"],
  ["enter", "/enter"],
  ["get-started", "/get-started"],
  ["compare", "/compare"],
  ["compare-cometchat", "/compare/cometchat"],
  ["features", "/features"],
  ["features-realtime", "/features/realtime"],
  ["for-teams", "/for-teams"],
  ["trust", "/trust"],
  ["migrate-chatgpt", "/migrate-chatgpt"],
  ["dpa", "/dpa"],
  ["terms", "/terms"],
  ["privacy-policy", "/privacy-policy"],
  ["subprocessors", "/subprocessors"],
  ["demo", "/demo"],
  ["status", "/status"],
  // W6: guides + public utility pages (isPublicSitePath family).
  // /cli-auth is Clerk-gated (SignedOut/SignIn need a publishable key; the
  // integrated harness boots without one), so it stays out of the shots.
  ["guides", "/guides"],
  ["guide-jwt-auth", "/guides/jwt-auth"],
  ["guide-pusher-saas", "/guides/pusher-alternative-saas"],
  ["incident", "/incident"],
  ["support", "/support"],
  ["pr-review", "/pr-review"],
  ["labs", "/labs"],
  ["report", "/report"],
  ["share-non-public", "/share/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
];

const MOBILE_PAGES: Array<[string, string]> = [
  ["dashboard", "/dashboard"],
  ["inbox", "/inbox"],
  ["pricing", "/pricing"],
  ["home", "/"],
  ["guide-jwt-auth", "/guides/jwt-auth"],
  ["report", "/report"],
];

test.skip(!!process.env.CI, "craft baseline screenshots are a local tool");

async function shoot(page: Page, path: string, file: string, viewport: ViewportSize) {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
  // WebSocket pages never go idle; settle with a short timeout instead of failing.
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: join(OUT, file), fullPage: true });
}

test.describe("craft baseline", () => {
  test.beforeAll(() => {
    mkdirSync(OUT, { recursive: true });
  });

  test("console pages (desktop)", async ({ page }) => {
    test.setTimeout(300_000);
    const jwt = skipWithoutAdminJwt();
    await seedAdminSession(page, jwt);
    for (const [name, path] of CONSOLE_PAGES) {
      await shoot(page, path, `console-${name}-desktop.png`, DESKTOP);
    }
  });

  test("marketing pages (desktop)", async ({ page }) => {
    test.setTimeout(300_000);
    for (const [name, path] of MARKETING_PAGES) {
      await shoot(page, path, `marketing-${name}-desktop.png`, DESKTOP);
    }
  });

  test("mobile", async ({ page }) => {
    test.setTimeout(180_000);
    const jwt = skipWithoutAdminJwt();
    await seedAdminSession(page, jwt);
    for (const [name, path] of MOBILE_PAGES) {
      await shoot(page, path, `mobile-${name}.png`, MOBILE);
    }
  });
});
