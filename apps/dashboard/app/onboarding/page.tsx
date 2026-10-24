"use client";

import { useEffect } from "react";
import { ConsoleShell } from "../components/console-shell";
import { OnboardingPlayground } from "./onboarding-playground";
import { OnboardingProgressStrip } from "./onboarding-progress-strip";
import { useOnboardingWizard } from "./use-onboarding-wizard";

export default function OnboardingPage() {
  const wizard = useOnboardingWizard();

  useEffect(() => {
    if (!wizard.notice) return;
    const t = window.setTimeout(() => wizard.setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [wizard.notice, wizard.setNotice]);

  return (
    <ConsoleShell data-testid="onboarding-page">
      <OnboardingProgressStrip
        stepContext={wizard.stepContext}
        activeStep={wizard.activeStep}
        onStepClick={(s) => wizard.setActiveStep(s)}
      />

      {wizard.isReviewMode ? (
        <p
          className="mb-4 rounded-xl border border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground"
          data-testid="onboarding-review-banner"
        >
          Review mode — your Quickstart is already complete, so nothing auto-advances. Buttons
          still act on your project if you click them.
        </p>
      ) : null}

      {wizard.notice && !wizard.error ? (
        <p className="mb-4 text-center text-xs text-emerald-700">{wizard.notice}</p>
      ) : null}

      <OnboardingPlayground wizard={wizard} />
    </ConsoleShell>
  );
}
