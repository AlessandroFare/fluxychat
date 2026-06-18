"use client";

import Link from "next/link";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Banner } from "../components/ui";
import { OnboardingPlayground } from "./onboarding-playground";
import { OnboardingProgressStrip } from "./onboarding-progress-strip";
import { useOnboardingWizard } from "./use-onboarding-wizard";

export default function OnboardingPage() {
  const wizard = useOnboardingWizard();

  return (
    <ConsoleShell data-testid="onboarding-page">
      <ConsolePageHeader
        title="Get started in 5 steps"
        description="You will send a real message over a live WebSocket. Each step builds on the last."
      />

      {wizard.notice && !wizard.error ? (
        <div className="mb-4">
          <Banner variant="success">{wizard.notice}</Banner>
        </div>
      ) : null}

      {wizard.isReviewMode ? (
        <div className="mb-4">
          <Banner variant="info">
            You are already set up. Send another message below, or head to the{" "}
            <Link href="/" className="font-medium underline underline-offset-2">
              console home
            </Link>
            .
          </Banner>
        </div>
      ) : null}

      <OnboardingProgressStrip stepContext={wizard.stepContext} activeStep={wizard.activeStep} />
      <OnboardingPlayground wizard={wizard} />

      <p className="mt-6 text-xs text-muted-foreground">
        Your messages are stored on the Worker running at{" "}
        <code className="rounded border border-border bg-muted/50 px-1 font-mono text-[10px] text-slate-700">
          {wizard.workerUrl}
        </code>{" "}
        &middot; Need a different Worker?{" "}
        <Link href="/projects" className="font-medium text-foreground underline-offset-4 hover:underline">
          Switch project
        </Link>
      </p>
    </ConsoleShell>
  );
}
