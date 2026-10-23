"use client";

import { isClerkClientConfigured } from "@/lib/hosted-product";
import { OnboardingAuthStepClerk } from "./onboarding-auth-step-clerk";
import { ManualJwtFields } from "./onboarding-auth-step-manual";

interface OnboardingAuthStepProps {
  adminJwt: string;
  onAdminJwtChange: (value: string) => void;
  onContinue: () => void;
}

export function OnboardingAuthStep(props: OnboardingAuthStepProps) {
  if (isClerkClientConfigured()) {
    return <OnboardingAuthStepClerk {...props} />;
  }
  return <ManualJwtFields {...props} />;
}
