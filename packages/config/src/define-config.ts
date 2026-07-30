import type { FluxyConfig } from "./types.js";

/** Type-safe config authoring (Portal `defineConfig` parity). */
export function defineConfig(config: FluxyConfig): FluxyConfig {
  return config;
}

export function defineFluxyConfig(config: FluxyConfig): FluxyConfig {
  return defineConfig(config);
}
