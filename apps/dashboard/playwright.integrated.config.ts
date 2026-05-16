import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

const workerUrl = process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL ?? "http://127.0.0.1:8787";
const dashboardUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const e2eEnv = {
  ...process.env,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
  CLERK_SECRET_KEY: "",
  NEXT_PUBLIC_FLUXYCHAT_WORKER_URL: workerUrl,
  PORT: "3000",
};

/**
 * Full-stack onboarding: starts wrangler dev + Next production server.
 * Requires local Worker secrets (`.dev.vars`) and `E2E_ADMIN_JWT`.
 */
export default defineConfig({
  ...base,
  testMatch: "**/onboarding.integrated.spec.ts",
  timeout: 180_000,
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: "pnpm --filter @fluxychat/worker exec wrangler dev src/worker.js --port 8787",
          url: `${workerUrl.replace(/\/$/, "")}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          cwd: "../..",
        },
        {
          command: "pnpm build && pnpm exec next start -p 3000",
          url: dashboardUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 300_000,
          env: e2eEnv,
        },
      ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
