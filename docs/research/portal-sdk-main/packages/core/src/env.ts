/**
 * Development-mode diagnostics.
 *
 * Warnings are emitted only outside production, so a misuse is loud in development and
 * silent in a shipped bundle. `NODE_ENV` is read defensively — `process` may be absent in
 * a browser without a bundler define.
 */
export function isDevMode(): boolean {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  return proc?.env?.["NODE_ENV"] !== "production";
}

export function devWarn(message: string): void {
  if (isDevMode()) console.warn(`[portal] ${message}`);
}
