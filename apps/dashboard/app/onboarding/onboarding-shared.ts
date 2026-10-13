import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { Sparkles, ShieldCheck, Code2 } from "lucide-react";

export interface CreatedProject {
  id: string;
  name: string;
  created_at: string;
}

export interface CreatedRoom {
  id: string;
  type: string;
  name: string;
  created_at: string;
}

export interface CreatedAgent {
  id: string;
  name: string;
}

export interface OnboardingStepDef {
  title: string;
  short: string;
  icon: ComponentType<LucideProps>;
}

/**
 * Three-screen onboarding: project, approval in the room, then drop-in snippet.
 */
export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  {
    title: "Project",
    short: "Humans and agents in the same room.",
    icon: Sparkles,
  },
  {
    title: "Approval",
    short: "See an agent ask for permission.",
    icon: ShieldCheck,
  },
  {
    title: "Your app",
    short: "Run it in a Next.js, Vite, or plain JS project.",
    icon: Code2,
  },
] as const;

export interface OnboardingStepContext {
  adminJwt: string;
  activeProject: CreatedProject | null;
  memberJwt: string;
  room: CreatedRoom | null;
  messageCount: number;
  userSentMessage?: boolean;
}

export function isOnboardingStepComplete(step: number, args: OnboardingStepContext): boolean {
  const { activeProject, memberJwt, userSentMessage } = args;
  const hasMember = Boolean(memberJwt.trim());
  if (step === 0) return Boolean(activeProject?.id);
  if (step >= 1 && !hasMember) return false;
  if (step === 1) return Boolean(userSentMessage);
  return true;
}

export function firstIncompleteOnboardingStep(args: OnboardingStepContext): number {
  for (let i = 0; i < ONBOARDING_STEPS.length; i += 1) {
    if (!isOnboardingStepComplete(i, args)) return i;
  }
  return ONBOARDING_STEPS.length - 1;
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // ignore
  }
}
