"use client";

import { Check } from "lucide-react";
import { ONBOARDING_STEPS, isOnboardingStepComplete } from "./onboarding-shared";
import type { OnboardingWizard } from "./use-onboarding-wizard";
import { cn } from "@/lib/utils";

interface OnboardingProgressStripProps {
  stepContext: OnboardingWizard["stepContext"];
  activeStep: number;
}

export function OnboardingProgressStrip({ stepContext, activeStep }: OnboardingProgressStripProps) {
  const total = ONBOARDING_STEPS.length;
  const coreSteps = total - 1;
  const counterLabel =
    activeStep < coreSteps
      ? `Step ${activeStep + 1} of ${coreSteps}`
      : `Step ${activeStep + 1} (optional)`;

  return (
    <div className="mb-8" aria-label="Setup progress" data-testid="onboarding-progress">
      <p className="mb-4 text-center text-xs font-medium text-muted-foreground">
        {counterLabel}
      </p>
      <ol className="flex items-start justify-center gap-0">
        {ONBOARDING_STEPS.map((step, index) => {
          const done = isOnboardingStepComplete(index, stepContext);
          const current = index === activeStep;
          const Icon = step.icon;

          return (
            <li key={step.title} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-200",
                    done
                      ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                      : current
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted-foreground/30 bg-transparent text-muted-foreground/40",
                  )}
                >
                  {done ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </div>
                <span
                  className={cn(
                    "mt-1.5 max-w-[72px] text-center text-[10px] font-medium leading-tight transition-colors duration-200",
                    done
                      ? "text-emerald-700"
                      : current
                        ? "text-foreground"
                        : "text-muted-foreground/50",
                  )}
                >
                  {step.title}
                </span>
              </div>
              {index < total - 1 ? (
                <div
                  className={cn(
                    "mx-1 mb-5 h-px w-6 sm:w-10 md:w-16 transition-colors duration-200",
                    done ? "bg-emerald-400" : "bg-muted-foreground/20",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
