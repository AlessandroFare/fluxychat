"use client";

import { SignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { MarketingShell } from "@/app/components/marketing-shell";
import { clerkAuthAppearance } from "@/lib/clerk-copy";
import { isAllowedCliRedirectUri } from "@/lib/cli-bootstrap";

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
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white px-5 py-6 text-center shadow-sm">
      <p className="text-sm font-medium text-foreground">{status}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        If you already have a project we reuse it. We only mint a fresh member token.
      </p>
    </div>
  );
}

export default function CliAuthPage() {
  const [redirectUri, setRedirectUri] = useState("");
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
          <p className="text-xs font-semibold uppercase tracking-wider text-[#C2410C]">
            FluxyChat CLI
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Sign in to continue</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Same account as the console. First visit creates your project and assistant room.
            Later visits reuse them.
          </p>
        </div>
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
      </div>
    </MarketingShell>
  );
}
