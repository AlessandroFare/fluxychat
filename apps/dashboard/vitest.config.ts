import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": dirname,
      "~": dirname,
      // Subpath aliases must precede their bare specifier: Vite matches alias
      // keys by prefix, so "@fluxy-chat/sdk" would swallow the subpath.
      "@fluxy-chat/sdk/markdown": path.resolve(dirname, "../../packages/sdk/src/markdown.ts"),
      "@fluxy-chat/sdk": path.resolve(dirname, "../../packages/sdk/src/index.ts"),
      "@fluxy-chat/ui": path.resolve(dirname, "../../packages/ui/src/index.tsx"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**", "**/dist/**"],
  },
});
