"use client";

import Link from "next/link";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { markQuickstartComplete } from "@/lib/quickstart-progress";
import { resolveQuickstartUserKey } from "@/lib/onboarding-user-key";
import { ConsoleShell } from "../components/console-shell";
import { Banner } from "../components/ui";
import { OnboardingPlayground } from "./onboarding-playground";
import { OnboardingProgressStrip } from "./onboarding-progress-strip";
import { useOnboardingWizard } from "./use-onboarding-wizard";

export default function OnboardingPage() {
  const wizard = useOnboardingWizard();

  return (
    <ConsoleShell data-testid="onboarding-page">
      {/* Hide progress strip on the Welcome step (step 0) — it has its own full-screen hero */}
      {wizard.activeStep > 0 && (
        <OnboardingProgressStrip
          stepContext={wizard.stepContext}
          activeStep={wizard.activeStep}
          onStepClick={(s) => wizard.setActiveStep(s)}
        />
      )}

      {wizard.notice && !wizard.error ? (
        <div className="mb-4">
          <Banner variant="success">{wizard.notice}</Banner>
        </div>
      ) : null}

      {wizard.isReviewMode ? (
        <div className="mb-4">
          <Banner variant="info">
            You are already set up. Send another message below, or head to the{" "}
            <Link href={HOSTED_PATHS.console} className="font-medium underline underline-offset-2" onClick={() => {
              const key = resolveQuickstartUserKey(wizard.clerkUser?.id, wizard.userId);
              if (key) markQuickstartComplete(key);
            }}>
              console home
            </Link>
            .
          </Banner>
        </div>
      ) : null}

      <OnboardingPlayground wizard={wizard} />

      {/* Footer with worker URL — hidden on Welcome step */}
      {wizard.activeStep > 0 && (
        <p className="mt-6 text-xs text-muted-foreground">
          Your messages are stored on the Worker running at{" "}
          <code className="rounded border border-border bg-muted/50 px-1 font-mono text-[10px] text-slate-700">
            {wizard.workerUrl}
          </code>{" "}
          &middot; Need a different Worker?{" "}
          <Link
            href="/projects"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Switch project
          </Link>
        </p>
      )}
    </ConsoleShell>
  );
}
