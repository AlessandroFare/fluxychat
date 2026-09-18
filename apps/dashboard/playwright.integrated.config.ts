import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

const workerUrl = process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL ?? "http://127.0.0.1:8787";
const dashboardUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

const e2eEnv = {
  ...process.env,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
  CLERK_SECRET_KEY: "",
  NEXT_PUBLIC_FLUXY_E2E_SELF_HOST: "1",
  FLUXY_E2E_SELF_HOST: "1",
  NEXT_PUBLIC_FLUXYCHAT_WORKER_URL: workerUrl,
  NEXT_PUBLIC_FLUXYCHAT_CLOUD_URL: workerUrl,
  PORT: "3000",
};

/**
 * Full-stack onboarding: starts wrangler dev + Next production server.
 * Requires local Worker secrets (`.dev.vars`) and `E2E_ADMIN_JWT`.
 */
export default defineConfig({
  ...base,
  testMatch: "**/*.integrated.spec.ts",
  timeout: 180_000,
  globalSetup: "./e2e/global-setup.integrated.cjs",
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: "pnpm --filter @fluxy-chat/worker exec wrangler dev src/worker.js --port 8787",
          url: `${workerUrl.replace(/\/$/, "")}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          cwd: "../..",
          env: {
            ...process.env,
            NODE_ENV: "development",
            ALLOW_DEV_PROVISION: "true",
          },
        },
        {
          command: process.env.CI ? "pnpm build && pnpm exec next start -p 3000" : "pnpm dev",
          url: dashboardUrl,
          // Do not reuse a Next already started with Clerk keys in .env.local.
          reuseExistingServer: false,
          timeout: process.env.CI ? 300_000 : 180_000,
          env: e2eEnv,
        },
      ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Local Windows: PLAYWRIGHT_CHANNEL=chrome uses installed Chrome (no ~400MB browser download).
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
        launchOptions: {
          args: ["--disable-gpu", "--disable-dev-shm-usage"],
        },
      },
    },
  ],
});
