import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sdkSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../sdk/src/index.ts");

export default defineConfig({
  resolve: {
    alias: {
      "@fluxy-chat/sdk": sdkSrc,
    },
  },
  test: {
    environment: "node",
  },
});
