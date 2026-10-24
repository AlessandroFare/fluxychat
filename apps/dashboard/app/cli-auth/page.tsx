"use client";

import { SignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MarketingShell } from "@/app/components/marketing-shell";
import { clerkAuthAppearance } from "@/lib/clerk-copy";
import { isAllowedCliRedirectUri } from "@/lib/cli-redirect";
import { isClerkClientConfigured } from "@/lib/hosted-product";

export const dynamic = "force-dynamic";

function CliAuthRedirect() {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Opening your project…");
  const params = useMemo(() => {
    if (typeof window === "undefined") return { redirectUri: "", goDashboard: false };
    const search = new URLSearchParams(window.location.search);
    return {
      redirectUri: search.get("redirect_uri")?.trim() || "",
      goDashboard: search.get("next") === "dashboard" || !search.get("redirect_uri"),
    };
  }, []);

  useEffect(() => {
    const { redirectUri, goDashboard } = params;

    if (goDashboard && !redirectUri) {
      window.location.assign("/dashboard");
      return;
    }

    if (!isAllowedCliRedirectUri(redirectUri)) {
      setError("redirect_uri must be http://localhost or http://127.0.0.1");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/cli/bootstrap", { method: "POST" });
        const json = (await res.json()) as Record<string, unknown> & { error?: string; createdNewProject?: boolean };
        if (!res.ok) throw new Error(json.error || "Bootstrap failed");
        if (cancelled) return;
        if (json.createdNewProject) setStatus("Project ready. Sending you back…");
        else setStatus("Project already exists. Sending you back…");
        const encoded = btoa(JSON.stringify(json));
        const target = new URL(redirectUri);
        target.hash = `fluxy_cli=${encoded}`;
        window.location.assign(target.toString());
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Bootstrap failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-card px-6 py-6 text-center shadow-[var(--shadow-2)]">
      <p className="text-sm font-medium text-foreground">{status}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        If you already have a project we reuse it. We mint a member JWT and a publishable pk_ for public rooms.
      </p>
    </div>
  );
}

export default function CliAuthPage() {
  const [redirectUri, setRedirectUri] = useState("");
  const clerkOn = isClerkClientConfigured();
  useEffect(() => {
    setRedirectUri(new URLSearchParams(window.location.search).get("redirect_uri")?.trim() || "");
  }, []);
  const afterSignIn = redirectUri
    ? `/cli-auth?redirect_uri=${encodeURIComponent(redirectUri)}`
    : "/cli-auth";

  return (
    <MarketingShell className="flex min-h-[calc(100dvh-4rem)] max-w-lg items-center justify-center">
      <div className="w-full space-y-4">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            FluxyChat CLI
          </p>
          <h1
            className="mt-1 font-semibold text-foreground"
            style={{ fontSize: "clamp(1.75rem, 4vw, 2.5rem)", lineHeight: 1.15 }}
          >
            {clerkOn ? "Sign in to continue" : "Connect from the dashboard"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {clerkOn
              ? "Same account as the console. First visit creates your project and assistant room. Later visits reuse them."
              : "This deployment does not use Clerk. Open Quickstart to mint an admin JWT, then rerun the CLI."}
          </p>
        </div>
        {clerkOn ? (
          <>
            <SignedOut>
              <SignIn
                routing="hash"
                signUpUrl="/sign-up"
                forceRedirectUrl={afterSignIn}
                fallbackRedirectUrl={afterSignIn}
                appearance={clerkAuthAppearance}
              />
            </SignedOut>
            <SignedIn>
              <CliAuthRedirect />
            </SignedIn>
          </>
        ) : (
          <div className="rounded-2xl bg-card px-6 py-6 text-center shadow-[var(--shadow-2)]">
            <p className="text-sm font-medium text-foreground">
              Clerk is not configured on this deployment.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Open Quickstart to mint an admin JWT, then run the CLI again.
            </p>
            <Link
              href="/onboarding"
              className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-[#1B1D1B] px-6 py-3 text-sm font-medium transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B1D1B]"
              style={{ color: "#F3F3F0" }}
            >
              Open Quickstart
            </Link>
          </div>
        )}
      </div>
    </MarketingShell>
  );
}
