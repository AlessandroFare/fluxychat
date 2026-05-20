import { HOSTED_PATHS } from "@/lib/hosted-product";

/** After sign-up (also set in Clerk Dashboard → Paths). */
export const CLERK_SIGN_UP_REDIRECT_URL =
  process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL?.trim() ||
  HOSTED_PATHS.onboarding;

/** After sign-in; incomplete quickstart is handled by QuickstartGate. */
export const CLERK_SIGN_IN_REDIRECT_URL =
  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL?.trim() ||
  HOSTED_PATHS.console;
