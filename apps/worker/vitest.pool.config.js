import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

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
