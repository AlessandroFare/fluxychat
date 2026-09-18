import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WORKER_ROUTE_PREFIX_INDEX } from "../lib/worker-route-dispatch.js";

const KERNEL_PREFIXES = [
  "rooms",
  "messages",
  "inbox",
  "notifications",
  "presence",
  "projects",
  "users",
  "push",
];

describe("worker surface map (phase 0)", () => {
  it("indexes kernel prefixes used by the dashboard and SDK", () => {
    for (const prefix of KERNEL_PREFIXES) {
      expect(WORKER_ROUTE_PREFIX_INDEX[prefix], prefix).toBeTruthy();
      expect(WORKER_ROUTE_PREFIX_INDEX[prefix].length).toBeGreaterThan(0);
    }
  });

  it("counts *-http.js vs sibling *.test.js (gap is expected; campaign tracks it)", () => {
    const routesDir = join(dirname(fileURLToPath(import.meta.url)));
    const files = readdirSync(routesDir).filter((f) => f.endsWith("-http.js"));
    const tests = new Set(readdirSync(routesDir).filter((f) => f.endsWith(".test.js")));
    const missing = files.filter((f) => !tests.has(f.replace(/\.js$/, ".test.js")));
    expect(files.length).toBeGreaterThan(150);
    // Kernel files we just covered by kernel-http-contract.test.js, not per-file tests.
    expect(missing.length).toBeGreaterThan(50);
    expect(missing).not.toContain("kernel-http-contract.js");
  });
});
