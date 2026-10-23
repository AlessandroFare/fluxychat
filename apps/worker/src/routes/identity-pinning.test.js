import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A2-6: route payloads must not let the request body override identity fields
// (`projectId`, `userId`, …). Identity keys therefore have to come AFTER the
// `...body` spread, or the lib must ignore them — this guard enforces the
// spread order mechanically across every route module.
const IDENTITY_KEY = /(projectId|publisherId|actorUserId|userId|eventId)\s*[:,\s}]/;

const routesDir = dirname(fileURLToPath(import.meta.url));

describe("route body identity pinning (A2-6)", () => {
  it("identity fields never appear before ...body on the same line", () => {
    const offenders = [];
    for (const file of readdirSync(routesDir)) {
      if (!file.endsWith(".js") || file.includes(".test.")) continue;
      const lines = readFileSync(join(routesDir, file), "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        const spread = line.indexOf("...body");
        if (spread === -1) return;
        const open = line.lastIndexOf("{", spread);
        if (open === -1 || open > spread) return;
        const before = line.slice(open, spread);
        if (IDENTITY_KEY.test(before)) {
          offenders.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
