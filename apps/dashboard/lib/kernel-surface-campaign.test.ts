import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PAGE_METADATA, SITE_DESCRIPTION } from "./marketing-copy";
import { isPublicSitePath } from "./public-site-paths";

const AI_TELLS =
  /\b(pivotal|delve|testament|underscore[sd]?|vibrant tapestry|groundbreaking|nestled|evolving landscape|it's not just)\b/i;

const KERNEL_PRODUCT = ["/rooms", "/inbox", "/projects", "/onboarding", "/profile", "/embed", "/notifications"];

function walkPages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkPages(full, out);
    else if (name === "page.tsx") out.push(full);
  }
  return out;
}

describe("dashboard surface map (phase 0)", () => {
  const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", "app");

  it("splits public marketing routes from kernel console routes", () => {
    const pages = walkPages(appDir);
    expect(pages.length).toBeGreaterThan(100);

    const routes = pages.map((p) => {
      const rel = p.slice(appDir.length).replace(/\\/g, "/").replace(/\/page\.tsx$/, "") || "/";
      const route = rel.replace(/\/\[[^\]]+\]/g, "/:param");
      return { route, public: isPublicSitePath(route === "" ? "/" : route) };
    });

    const marketing = routes.filter((r) => r.public);
    const product = routes.filter((r) => !r.public);

    expect(marketing.some((r) => r.route === "/" || r.route.startsWith("/guides"))).toBe(true);
    expect(product.length).toBeGreaterThan(marketing.length / 2);

    for (const path of KERNEL_PRODUCT) {
      expect(isPublicSitePath(path)).toBe(false);
    }
  });
});

describe("public marketing copy (humanizer)", () => {
  it("does not use the usual LLM filler in SEO descriptions", () => {
    const blobs = [
      SITE_DESCRIPTION,
      ...Object.values(PAGE_METADATA).flatMap((m) => [
        String(m.title ?? ""),
        String(m.description ?? ""),
      ]),
    ];
    for (const text of blobs) {
      expect(text, text).not.toMatch(AI_TELLS);
    }
  });
});

describe("kernel console copy", () => {
  it("rooms page tells you to get a JWT from Projects when none is pasted", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "app", "rooms", "page.tsx"),
      "utf8",
    );
    expect(src).toContain("JWT required (member or admin from Projects / Onboarding).");
  });

  it("projects page asks for an admin JWT under Session", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "app", "projects", "page.tsx"),
      "utf8",
    );
    expect(src).toContain("Paste an admin JWT under Session settings to load projects.");
  });

  it("inbox empty session copy points at Quickstart", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "app", "inbox", "page.tsx"),
      "utf8",
    );
    expect(src).toContain("Mint a member JWT in Quickstart to load your unified inbox.");
  });

  it("agents console asks for admin JWT before listing or invoking", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "app", "agents", "agents-console-context.tsx"),
      "utf8",
    );
    expect(src).toContain("Admin JWT required. Configure session in Projects or use a valid token.");
    expect(src).toContain("invokeAgentRest");
  });

  it("beta verticals and webhooks tell you to connect a session", () => {
    const app = join(dirname(fileURLToPath(import.meta.url)), "..", "app");
    const collab = readFileSync(join(app, "collab", "page.tsx"), "utf8");
    const fleet = readFileSync(join(app, "fleet", "page.tsx"), "utf8");
    const iot = readFileSync(join(app, "iot", "page.tsx"), "utf8");
    const webhooks = readFileSync(join(app, "webhooks", "page.tsx"), "utf8");
    expect(collab).toContain("Sign in with your project JWT");
    expect(fleet).toContain("Connect a project session to use Fleet Tracking.");
    expect(iot).toContain("Admin JWT required.");
    expect(webhooks).toContain("Mint an admin JWT in Quickstart to manage webhooks.");
  });

  it("huddles console is labs, JWT-gated, and does not claim production video", () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "app", "huddles", "page.tsx"),
      "utf8",
    );
    expect(src).toContain("Admin JWT required. Copy one from");
    expect(src).toContain("REALTIME_SFU_ALLOW_VIDEO=true");
    expect(src).toContain("not Cloudflare's meter");
  });

  it("labs consoles keep JWT gates and do not claim HIPAA BAA or financial execution", () => {
    const app = join(dirname(fileURLToPath(import.meta.url)), "..", "app");
    const hipaa = readFileSync(join(app, "settings", "hipaa", "page.tsx"), "utf8");
    const health = readFileSync(join(app, "health", "page.tsx"), "utf8");
    const finance = readFileSync(join(app, "finance", "page.tsx"), "utf8");
    const stream = readFileSync(join(app, "stream", "page.tsx"), "utf8");
    const game = readFileSync(join(app, "game", "page.tsx"), "utf8");
    const dlp = readFileSync(join(app, "settings", "dlp", "page.tsx"), "utf8");
    const bridges = readFileSync(join(app, "bridges", "page.tsx"), "utf8");
    const builder = readFileSync(join(app, "chatbot-builder", "page.tsx"), "utf8");
    const mcp = readFileSync(join(app, "settings", "mcp", "page.tsx"), "utf8");
    const marketplace = readFileSync(join(app, "marketplace", "page.tsx"), "utf8");
    const bar = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "app", "components", "console-project-room-bar.tsx"),
      "utf8",
    );
    const baa = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "hipaa-client.ts"), "utf8");

    expect(hipaa).toContain("Admin JWT required. Copy from Projects after onboarding.");
    expect(hipaa).toContain("Third-party Type 2 audit remains separate until revenue.");
    expect(baa).toContain("template, not legal advice");
    expect(health).toContain("does not include a BAA");
    expect(finance).toContain("No PAN storage and no trade execution");
    expect(stream).toContain("WHIP/HLS ingest needs Cloudflare Stream secrets");
    expect(game).toContain("Sign in so matchmaking hits your Worker D1 tables.");
    expect(dlp).toContain("Admin JWT required. Copy one from");
    expect(bridges).toContain("Admin JWT required. Copy one from");
    expect(builder).toContain("Admin JWT required.");
    expect(mcp).toContain("Admin JWT required. Copy one from");
    expect(marketplace).toContain("Admin JWT required.");
    expect(bar).toContain("Sign in and connect a project to persist data to your Worker");
  });
});
