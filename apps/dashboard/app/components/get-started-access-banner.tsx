"use client";

import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import { hasClerkPublishableKey } from "@/lib/clerk-config";
import { HOSTED_COPY, HOSTED_PATHS } from "@/lib/hosted-product";
import { useConsoleSetupPhase } from "./dashboard-session";

export function GetStartedAccessBanner() {
  const phase = useConsoleSetupPhase();
  const clerkOn = hasClerkPublishableKey();

  if (phase === "ready") return null;

  return (
    <div
      className="mb-8 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-4 sm:px-5"
      role="status"
    >
      <p className="font-medium text-slate-900">
        {phase === "no_jwt"
          ? "Sign in to unlock the console sidebar"
          : "Pick a project to use rooms and billing"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Sign in to provision hosted cloud, or run the wizard with a manual admin JWT if you self-host.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {clerkOn ? (
          <>
            <SignUpButton mode="redirect" forceRedirectUrl={HOSTED_PATHS.onboarding}>
              <Button type="button" size="sm">
                {HOSTED_COPY.startFree}
              </Button>
            </SignUpButton>
            <SignInButton mode="redirect" forceRedirectUrl={HOSTED_PATHS.onboarding}>
              <Button type="button" size="sm" variant="outline">
                {HOSTED_COPY.signIn}
              </Button>
            </SignInButton>
          </>
        ) : (
          <Button asChild size="sm">
            <Link href={HOSTED_PATHS.onboarding}>{HOSTED_COPY.connectAccount}</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link href={HOSTED_PATHS.onboarding}>{HOSTED_COPY.quickstart} wizard</Link>
        </Button>
      </div>
    </div>
  );
}
