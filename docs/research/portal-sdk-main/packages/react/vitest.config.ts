import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// The hooks are exercised against core's *source* (not its built dist) so that the Portal
// under test and the transport seam the tests inject into (core's setSocketFactory) share one
// module instance — injecting into a separately-bundled dist would silently no-op. Product
// code still imports the public `@portalsdk/core`; this alias only applies under test.
const coreSrc = fileURLToPath(new URL("../core/src/index.ts", import.meta.url));

export default defineConfig({
  test: {
    name: "react",
    environment: "jsdom",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "test/**/*.test.ts",
      "test/**/*.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@portalsdk/core": coreSrc,
    },
  },
});
