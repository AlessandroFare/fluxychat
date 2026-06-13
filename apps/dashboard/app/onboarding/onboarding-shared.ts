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

export const ONBOARDING_STEPS = [
  {
    title: "Connect account",
    short: "Sign in on hosted cloud, or paste an admin JWT if you self-host.",
  },
  {
    title: "Create project",
    short: "Gets API keys and quotas on your Worker. On hosted cloud this often already exists after sign-in.",
  },
  {
    title: "Mint member JWT",
    short: "Browser token for rooms. Minted server-side so the API key never hits the client.",
  },
  {
    title: "Create room",
    short: "A channel your SDK can join with that member JWT.",
  },
  {
    title: "First message",
    short: "Send one message over WebSocket to confirm delivery works.",
  },
  {
    title: "Try an agent (optional)",
    short: "Register a bot and invoke it once. Custom streaming bots: docs/cookbook/bot-streaming-fluxy-message-stream.md",
  },
] as const;

export interface OnboardingStepContext {
  adminJwt: string;
  activeProject: CreatedProject | null;
  memberJwt: string;
  room: CreatedRoom | null;
  messageCount: number;
}

export function isOnboardingStepComplete(step: number, args: OnboardingStepContext): boolean {
  const { adminJwt, activeProject, memberJwt, room, messageCount } = args;
  const hasMember = Boolean(memberJwt.trim());
  if (step === 0) return adminJwt.trim().length >= 12;
  if (step === 1) return Boolean(activeProject?.id);
  if (step === 2) return hasMember;
  if (step >= 3 && !hasMember) return false;
  if (step === 3) return Boolean(room?.id);
  if (step === 4) return messageCount >= 1;
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
