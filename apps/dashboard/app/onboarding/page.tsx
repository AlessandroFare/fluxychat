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
        title="Quickstart playground"
        description={
          <>
            Connect, project, member JWT, room, and message — in one panel. Worker URL:{" "}
            <code className="rounded border border-border bg-muted/50 px-1 font-mono text-xs">
              {wizard.workerUrl}
            </code>
          </>
        }
      />
      <p className="mb-6 text-xs text-muted-foreground">
        Active project:{" "}
        <code className="rounded border border-border bg-muted/50 px-1 py-0.5">
          {wizard.project?.name || "none yet"}
        </code>{" "}
        ·
        <Link href="/" className="ml-2 font-medium text-foreground underline-offset-4 hover:underline">
          Console home
        </Link>
      </p>

      {wizard.error ? <Banner variant="error">Error: {wizard.error}</Banner> : null}
      {wizard.notice ? <Banner variant="success">{wizard.notice}</Banner> : null}

      {wizard.isReviewMode ? (
        <div className="mb-4">
          <Banner variant="info">
            Review mode: you are already set up. Repeat any section below, or return to the{" "}
            <Link href="/" className="font-medium underline underline-offset-2">
              overview
            </Link>
            .
          </Banner>
        </div>
      ) : null}

      <OnboardingProgressStrip stepContext={wizard.stepContext} />
      <OnboardingPlayground wizard={wizard} />
    </ConsoleShell>
  );
}
