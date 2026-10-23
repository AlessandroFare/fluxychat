import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-plugin";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./pool/wrangler.toml" },
    }),
  ],
  test: {
    include: ["pool/**/*.pool.test.js"],
  },
});
