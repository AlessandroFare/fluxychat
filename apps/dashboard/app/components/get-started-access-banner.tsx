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
      <p className="font-medium text-foreground">
        {phase === "no_jwt"
          ? "Public rooms start in the browser. Console sign-in is for hosted ops."
          : "Pick a project to use rooms and billing"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Put a pk_ on FluxyRealtimeProvider and call useChat. Sign in only if you want hosted cloud, billing, or Bridges. Self-host with a manual admin JWT in the wizard.
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
