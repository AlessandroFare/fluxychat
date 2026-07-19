import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "wire-protocol",
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
