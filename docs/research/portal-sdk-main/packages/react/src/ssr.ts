/**
 * Server-environment detection.
 *
 * The hooks connect over WebSockets and read `document`/`window`, which don't exist during
 * server rendering (Next.js runs Client Component code during its server prerender despite
 * `"use client"`). Rather than fail loudly there, each hook checks this and takes an inert
 * path instead: no `acquire()`, no network, no effect registration, and a stable idle
 * snapshot. On an actual client, `window` is always defined, so this never engages there —
 * client behavior is unchanged.
 */
export function isServerEnvironment(): boolean {
  return typeof window === "undefined";
}
