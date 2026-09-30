import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const learnDir = join(here, "../../../docs/content/docs/learn");

describe("capabilities.json vs status-and-limits", () => {
  it("every claim phrase appears in the status page", () => {
    const capabilities = JSON.parse(readFileSync(join(learnDir, "capabilities.json"), "utf8"));
    const mdx = readFileSync(join(learnDir, "status-and-limits.mdx"), "utf8");
    expect(capabilities.version).toBe(1);
    for (const claim of capabilities.claims) {
      expect(mdx, claim.id).toContain(claim.phrase);
    }
  });
});
