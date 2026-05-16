"use client";

import { SignInButton, SignUpButton, useUser } from "@clerk/nextjs";
import { Check } from "lucide-react";
import { Button } from "~/components/ui/button";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { ConnectFluxyButton } from "./connect-fluxy-button";
import { ManualJwtFields } from "./onboarding-auth-step-manual";
import { useDashboardSession } from "./dashboard-session";

interface OnboardingAuthStepClerkProps {
  adminJwt: string;
  onAdminJwtChange: (value: string) => void;
  onContinue: () => void;
}

export function OnboardingAuthStepClerk({
  adminJwt,
  onAdminJwtChange,
  onContinue,
}: OnboardingAuthStepClerkProps) {
  const { isSignedIn } = useUser();
  const { activeProject } = useDashboardSession();
  const connected = adminJwt.trim().length >= 12;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Sign in to provision Fluxychat Cloud. We create a project, keep the API key on the server, and mint operator
        JWTs for this browser session.
      </p>
      {!isSignedIn ? (
        <div className="flex flex-wrap gap-2">
          <SignInButton mode="redirect" forceRedirectUrl={HOSTED_PATHS.onboarding}>
            <Button type="button">Sign in</Button>
          </SignInButton>
          <SignUpButton mode="redirect" forceRedirectUrl={HOSTED_PATHS.onboarding}>
            <Button type="button" variant="outline">
              Create account
            </Button>
          </SignUpButton>
        </div>
      ) : connected ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <p className="font-medium">Connected to Fluxychat Cloud</p>
              <p className="mt-1 text-emerald-900/80">
                {activeProject?.name
                  ? `Project “${activeProject.name}” is ready. Continue to the next step.`
                  : "Operator JWT is in this browser session. Continue to the next step."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="default" onClick={onContinue}>
              Continue
            </Button>
            <ConnectFluxyButton label="Refresh connection" skipRedirect onConnected={onContinue} />
          </div>
        </div>
      ) : (
        <ConnectFluxyButton label="Connect Fluxychat Cloud" skipRedirect onConnected={onContinue} />
      )}
      <details className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-sm">
        <summary className="cursor-pointer font-medium text-foreground">
          Advanced: self-host or paste admin JWT
        </summary>
        <ManualJwtFields
          adminJwt={adminJwt}
          onAdminJwtChange={onAdminJwtChange}
          onContinue={onContinue}
          className="mt-4"
        />
      </details>
    </div>
  );
}
