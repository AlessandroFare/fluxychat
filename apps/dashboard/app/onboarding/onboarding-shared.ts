import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { Sparkles, Layers, MessageSquare, Compass, CheckCircle2 } from "lucide-react";

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
 * Redesigned 5-step onboarding flow.
 *
 * 0 — Welcome: hero screen with value props
 * 1 — Create Project: name, description, auto API key
 * 2 — First Chat: live chat with the AI agent
 * 3 — Explore Features: cards linking to key areas
 * 4 — You're all set: summary and next steps
 */
export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  {
    title: "Welcome",
    short: "AI-native chat that runs on your edge.",
    icon: Sparkles,
  },
  {
    title: "Create Project",
    short: "Your isolated namespace. All traffic, quotas, and keys live here.",
    icon: Layers,
  },
  {
    title: "First Chat",
    short: "Send a message and see the AI respond in real time.",
    icon: MessageSquare,
  },
  {
    title: "Explore Features",
    short: "Discover Card Builder, DevTools, CLI, and Security.",
    icon: Compass,
  },
  {
    title: "You're all set",
    short: "Everything is ready. Go build something great.",
    icon: CheckCircle2,
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
  const { adminJwt, activeProject, memberJwt, room, userSentMessage } = args;
  const hasMember = Boolean(memberJwt.trim());
  if (step === 0) return true; // Welcome is always "complete" (it's a landing screen)
  if (step === 1) return Boolean(activeProject?.id);
  if (step >= 2 && !hasMember) return false;
  if (step === 2) return Boolean(userSentMessage);
  if (step === 3) return true; // Explore is optional — always passable
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
