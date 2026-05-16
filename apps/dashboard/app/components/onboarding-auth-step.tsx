"use client";

import { OnboardingAuthStepClerk } from "./onboarding-auth-step-clerk";
import { ManualJwtFields } from "./onboarding-auth-step-manual";

const clerkOn = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());

interface OnboardingAuthStepProps {
  adminJwt: string;
  onAdminJwtChange: (value: string) => void;
  onContinue: () => void;
}

export function OnboardingAuthStep(props: OnboardingAuthStepProps) {
  if (clerkOn) {
    return <OnboardingAuthStepClerk {...props} />;
  }
  return <ManualJwtFields {...props} />;
}
