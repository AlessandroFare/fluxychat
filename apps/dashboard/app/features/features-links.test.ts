import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appDir = existsSync(join(process.cwd(), "app/features/page.tsx"))
  ? join(process.cwd(), "app")
  : join(process.cwd(), "apps/dashboard/app");
const source = readFileSync(join(appDir, "features/page.tsx"), "utf8");
const hrefs = [...source.matchAll(/href: "(\/[^"]+)"/g)].map((match) => match[1]);

describe("features page links", () => {
  it("reads the card links", () => {
    expect(hrefs.length).toBeGreaterThan(30);
  });

  it("points every card at a page that exists", () => {
    const missing = hrefs.filter(
      (href) => !existsSync(join(appDir, href.slice(1), "page.tsx")),
    );
    expect(missing).toEqual([]);
  });
});
