import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const isCi = Boolean(process.env.CI);

const e2eEnv = {
  ...process.env,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
  CLERK_SECRET_KEY: "",
  NEXT_PUBLIC_FLUXYCHAT_WORKER_URL:
    process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL ?? "http://127.0.0.1:8787",
  PORT: "3000",
};

export default defineConfig({
  testDir: "./e2e",
  testMatch: isCi ? "**/onboarding.smoke.spec.ts" : undefined,
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: isCi ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : isCi
      ? {
          command: "pnpm build && pnpm exec next start -p 3000",
          url: baseURL,
          reuseExistingServer: false,
          timeout: 300_000,
          env: e2eEnv,
        }
      : {
          command: "pnpm dev",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 180_000,
          env: e2eEnv,
        },
});
