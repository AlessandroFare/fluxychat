"use client";

import { ONBOARDING_STEPS, isOnboardingStepComplete } from "./onboarding-shared";
import type { OnboardingWizard } from "./use-onboarding-wizard";
import { cn } from "@/lib/utils";

interface OnboardingProgressStripProps {
  stepContext: OnboardingWizard["stepContext"];
}

export function OnboardingProgressStrip({ stepContext }: OnboardingProgressStripProps) {
  return (
    <ol
      className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Quickstart progress"
      data-testid="onboarding-progress"
    >
      {ONBOARDING_STEPS.map((step, index) => {
        const done = isOnboardingStepComplete(index, stepContext);
        return (
          <li
            key={step.title}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-sm",
              done
                ? "border-emerald-200/80 bg-emerald-50/80 text-emerald-950"
                : "border-border/70 bg-muted/20 text-muted-foreground",
            )}
          >
            <span className="font-medium text-foreground">{step.title}</span>
            <p className="mt-0.5 text-xs">{done ? "Done" : step.short}</p>
          </li>
        );
      })}
    </ol>
  );
}
