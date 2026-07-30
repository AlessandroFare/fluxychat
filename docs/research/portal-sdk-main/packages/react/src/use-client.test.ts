// @vitest-environment node
// This test only reads built files. It runs in node (not jsdom) because jsdom overrides the
// global URL, which breaks fileURLToPath(new URL(...)) resolution.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const distFile = (name: string) =>
  fileURLToPath(new URL(`../dist/${name}`, import.meta.url));

// Only meaningful against built output; `pnpm test` on a fresh clone has no dist yet.
const built = existsSync(distFile("index.js"));

describe.skipIf(!built)("use client banner", () => {
  it.each(["index.js", "index.cjs"])(
    "is the first directive in dist/%s, exactly once",
    (name) => {
      const lines = readFileSync(distFile(name), "utf8").split("\n");

      // The directive must be the very first statement.
      expect(lines[0]).toBe('"use client";');
      // …and appear exactly once as a directive. Counting directive-form *lines* (not any
      // occurrence of the substring) so a legitimate mention inside a string — e.g. the SSR
      // error message — doesn't register, while a duplicated banner (treeshake dropping and
      // re-adding it, or a stray source directive) still would.
      const directiveLines = lines.filter(
        (l) => l.trim() === '"use client";' || l.trim() === "'use client';",
      );
      expect(directiveLines).toHaveLength(1);
    },
  );
});
