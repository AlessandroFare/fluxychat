import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "cloudflare:workers": path.resolve(dir, "src/test-stubs/cloudflare-workers.js"),
    },
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
});
