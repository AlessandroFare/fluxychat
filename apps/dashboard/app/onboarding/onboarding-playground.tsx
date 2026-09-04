"use client";

import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "../components/ui";
import { cn } from "@/lib/utils";
import type { OnboardingWizard } from "./use-onboarding-wizard";
import { WelcomeStep } from "./welcome-step";
import { CreateProjectStep } from "./create-project-step";
import { FirstChatStep } from "./first-chat-step";
import { ExploreFeaturesStep } from "./explore-features-step";
import { FinishStep } from "./finish-step";

interface OnboardingPlaygroundProps {
  wizard: OnboardingWizard;
}

export function OnboardingPlayground({ wizard: w }: OnboardingPlaygroundProps) {
  const step = w.activeStep;

  return (
    <div className="space-y-6" data-testid="onboarding-playground">
      <div className="transition-opacity duration-200" key={step}>
        {/* Step 0: Welcome */}
        {step === 0 && <WelcomeStep wizard={w} />}

        {/* Step 1: Create Project (includes auth + project + token) */}
        {step === 1 && <CreateProjectStep wizard={w} />}

        {/* Step 2: First Chat */}
        {step === 2 && <FirstChatStep wizard={w} />}

        {/* Step 3: Explore Features */}
        {step === 3 && <ExploreFeaturesStep wizard={w} />}

        {/* Step 4: You're all set! */}
        {step === 4 && <FinishStep wizard={w} />}
      </div>

      {/* Navigation — hidden on Welcome (step 0) since it has its own CTA */}
      {step > 0 && (
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

            <div className="flex items-center gap-2">
              {step === 1 && (
                <Button
                  variant="primary"
                  onClick={() => w.goNext()}
                  disabled={!isStepReady(step, w)}
                  title={!isStepReady(step, w) ? getBlockerHint(step, w) : undefined}
                >
                  Continue to Chat
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}

              {step === 2 && (
                <>
                  <p
                    className={cn(
                      "mr-3 hidden text-xs sm:block",
                      w.userSentMessage ? "text-emerald-600" : "text-muted-foreground",
                    )}
                  >
                    {w.userSentMessage
                      ? "Message sent. Continue when ready"
                      : "Send a message to continue"}
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => w.goNext()}
                    disabled={!w.userSentMessage}
                    title={!w.userSentMessage ? "Send a message first" : undefined}
                  >
                    Continue
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </>
              )}

              {step === 3 && (
                <Button variant="primary" onClick={() => w.goNext()}>
                  Finish
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {!isStepReady(step, w) && step < 3 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {getBlockerHint(step, w)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function isStepReady(step: number, w: OnboardingWizard): boolean {
  if (step === 1) return Boolean(w.project?.id) && Boolean(w.memberJwt.trim());
  if (step === 2) return w.userSentMessage;
  return true;
}

function getBlockerHint(step: number, w: OnboardingWizard): string {
  if (step === 1) {
    if (!w.adminJwt.trim()) return "Connect your account to continue.";
    if (!w.project?.id) return "Create a project to continue.";
    if (!w.memberJwt.trim()) return "Minting your token...";
  }
  if (step === 2) return "Send a message to continue.";
  return "";
}
