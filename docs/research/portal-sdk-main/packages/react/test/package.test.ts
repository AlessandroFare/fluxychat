// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

describe("package manifest", () => {
  it("declares react as a peer dependency, never a runtime dependency", () => {
    expect(pkg.peerDependencies?.["react"]).toBeDefined();
    expect(pkg.dependencies?.["react"]).toBeUndefined();
  });

  it("depends on @portalsdk/core at runtime", () => {
    expect(pkg.dependencies?.["@portalsdk/core"]).toBeDefined();
  });
});
