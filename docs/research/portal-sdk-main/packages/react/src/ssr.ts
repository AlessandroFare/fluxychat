/**
 * Client-only guard.
 *
 * The React bindings connect over WebSockets and read `document`/`window`; they have no
 * server rendering path in v1. Rather than half-work (render empty on the server, then
 * connect on the client), the hooks fail loudly the moment they run outside a browser — a
 * server-side render or a React Server Component — so the misuse is caught immediately with
 * a clear message instead of surfacing as a confusing hydration or transport error later.
 */
export function assertBrowser(): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error(
      "@portalsdk/react is client-only: its hooks cannot run during server-side " +
        "rendering or inside a React Server Component. Call them from a Client Component " +
        '("use client") that renders on the client. There is no SSR support in v1.',
    );
  }
}
