import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { UserPlus, Layers, Key, MessageSquare, Send, Bot } from "lucide-react";

export interface CreatedProject {
  id: string;
  name: string;
  created_at: string;
  apiKey: string;
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

export const ONBOARDING_STEPS: readonly OnboardingStepDef[] = [
  {
    title: "Connect account",
    short: "Authenticate with Clerk or paste your admin JWT.",
    icon: UserPlus,
  },
  {
    title: "Create project",
    short: "Your isolated namespace. All traffic, quotas, and keys live here.",
    icon: Layers,
  },
  {
    title: "Mint member JWT",
    short: "Browser-safe token minted server-side so your API key is never exposed.",
    icon: Key,
  },
  {
    title: "Create room",
    short: "A channel your SDK joins with the member JWT.",
    icon: MessageSquare,
  },
  {
    title: "First message",
    short: "Send one message over WebSocket to confirm delivery works.",
    icon: Send,
  },
  {
    title: "Try an agent (optional)",
    short: "Register a bot and invoke it once.",
    icon: Bot,
  },
] as const;

export interface OnboardingStepContext {
  adminJwt: string;
  activeProject: CreatedProject | null;
  memberJwt: string;
  room: CreatedRoom | null;
  messageCount: number;
  /**
   * True only when the *current user* has sent at least one message during
   * this onboarding session. History replay and inbound messages from other
   * members do NOT count — otherwise onboarding auto-completes when a user
   * revisits a room that already has messages. (Audit fix.)
   */
  userSentMessage?: boolean;
}

export function isOnboardingStepComplete(step: number, args: OnboardingStepContext): boolean {
  const { adminJwt, activeProject, memberJwt, room, userSentMessage } = args;
  const hasMember = Boolean(memberJwt.trim());
  if (step === 0) return adminJwt.trim().length >= 12;
  if (step === 1) return Boolean(activeProject?.id);
  if (step === 2) return hasMember;
  if (step >= 3 && !hasMember) return false;
  if (step === 3) return Boolean(room?.id);
  // Step 4 (first message) requires the user to have actually sent a message,
  // not merely that messages exist in the room (history replay / inbound).
  if (step === 4) return Boolean(userSentMessage);
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
