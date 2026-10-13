"use client";

import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "../components/ui";
import type { OnboardingWizard } from "./use-onboarding-wizard";
import { WelcomeStep } from "./welcome-step";
import { CreateProjectStep } from "./create-project-step";
import { FirstChatStep } from "./first-chat-step";
import { FinishStep } from "./finish-step";
import { OnboardingTips } from "./onboarding-tips";

interface OnboardingPlaygroundProps {
  wizard: OnboardingWizard;
}

export function OnboardingPlayground({ wizard: w }: OnboardingPlaygroundProps) {
  const step = w.activeStep;

  return (
    <div className="space-y-6" data-testid="onboarding-playground">
      <div className="transition-opacity duration-200" key={step}>
        {step === 0 ? (
          <div className="space-y-8">
            <WelcomeStep wizard={w} />
            <CreateProjectStep wizard={w} />
          </div>
        ) : null}
        {step === 1 ? <FirstChatStep wizard={w} /> : null}
        {step === 2 ? <FinishStep wizard={w} /> : null}
      </div>

      <OnboardingTips
        activeStep={step}
        userId={w.clerkUser?.id ?? w.userId}
      />

      <div className="sticky bottom-0 z-10 rounded-2xl bg-background/95 p-4 shadow-[var(--shadow-3)] backdrop-blur-sm">
        <div className="mx-auto flex items-center justify-between">
          {step > 0 ? (
            <Button variant="outline" onClick={() => w.goBack()}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 2 ? (
            <Button
              variant="primary"
              onClick={() => w.goNext()}
              disabled={!isStepReady(step, w)}
            >
              {step === 0 ? "See the approval" : "Put it in your app"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <div />
          )}
        </div>
        {!isStepReady(step, w) && step < 2 ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">{getBlockerHint(step, w)}</p>
        ) : null}
      </div>
    </div>
  );
}

function isStepReady(step: number, w: OnboardingWizard): boolean {
  if (step === 0) return Boolean(w.project?.id) && Boolean(w.memberJwt.trim());
  if (step === 1) return w.userSentMessage;
  return true;
}

function getBlockerHint(step: number, w: OnboardingWizard): string {
  if (step === 0) {
    if (!w.adminJwt.trim()) return "Sign in or paste an admin JWT.";
    if (!w.project?.id) return "Create a project first.";
    if (!w.memberJwt.trim()) return "Minting your token…";
  }
  if (step === 1) return "Approve the refund scene or send a chip first.";
  return "";
}
