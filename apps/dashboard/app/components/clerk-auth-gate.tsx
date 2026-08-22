"use client";

import Link from "next/link";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { Button } from "~/components/ui/button";

/** Client-only: must use literal env access so Next inlines NEXT_PUBLIC_* at build time. */
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? "";

export function ClerkAuthGate({ children }: { children: React.ReactNode }) {
  if (!publishableKey) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-950">
        <p className="font-medium">Clerk is not configured</p>
        <p className="mt-2 text-amber-900/90">
          Add <code className="rounded bg-white px-1 font-mono text-xs">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> to{" "}
          <code className="rounded bg-white px-1 font-mono text-xs">apps/dashboard/.env.local</code> and restart{" "}
          <code className="font-mono text-xs">pnpm dev</code>.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link href={HOSTED_PATHS.getStarted}>Manual quickstart</Link>
        </Button>
      </div>
    );
  }

  if (publishableKey.startsWith("pk_test_")) {
    return (
      <>
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-800 dark:text-amber-200">
          Clerk is using a development key on this host. Switch to a production instance (
          <code className="font-mono">pk_live_…</code>) in the dashboard env, then redeploy.
        </div>
        {children}
      </>
    );
  }

  return <>{children}</>;
}
