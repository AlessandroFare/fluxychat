import { defineConfig } from "vitest/config";

// Root runner: discovers every package that has its own vitest config.
// Each package remains independently testable via `pnpm --filter <pkg> test`.
export default defineConfig({
  test: {
    projects: ["packages/*"],
  },
});
