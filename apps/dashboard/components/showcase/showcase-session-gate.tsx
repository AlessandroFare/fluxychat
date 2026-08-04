"use client";

import { Loader2 } from "lucide-react";
import { DemoTurnstile } from "@/components/demo-turnstile";
import type { ShowcaseSession } from "./use-showcase-session";
import { ShowcaseUnavailable } from "./feature-code-panel";

/** Shared gate: loading, Turnstile, or unavailable before live SDK previews. */
export function ShowcaseSessionGate({
  session,
  children,
  requireRoom = true,
}: {
  session: ShowcaseSession;
  children: React.ReactNode;
  /** Some demos (push) only need a JWT client, not a room id. */
  requireRoom?: boolean;
}) {
  if (session.status === "loading") {
    return (
      <div className="flex h-full min-h-64 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        <span className="sr-only">Connecting to the live demo room</span>
      </div>
    );
  }

  if (session.status === "turnstile") {
    return (
      <div className="flex h-full min-h-64 flex-col items-center justify-center gap-4 p-6">
        <p className="text-center text-sm text-muted-foreground">
          Complete the Cloudflare check to use the live demo room (same as the public playground).
        </p>
        <DemoTurnstile
          onToken={(token) => session.completeTurnstile(token)}
          onError={() => session.retry()}
        />
      </div>
    );
  }

  if (session.status === "unavailable" || !session.client || (requireRoom && !session.roomId)) {
    return <ShowcaseUnavailable error={session.error} onRetry={session.retry} />;
  }

  return <>{children}</>;
}
