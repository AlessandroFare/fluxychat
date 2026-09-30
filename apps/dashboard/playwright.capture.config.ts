import { defineConfig, devices } from "@playwright/test";

/** Hits the Vite deal-room app. Does not start the Next dashboard. */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "deal-room-capture.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: [["list"]],
  use: {
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
