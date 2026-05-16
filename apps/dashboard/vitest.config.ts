import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": dirname,
      "~": dirname,
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**", "**/dist/**"],
  },
});
