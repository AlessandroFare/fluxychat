function isE2eSelfHost(): boolean {
  return (
    process.env.NEXT_PUBLIC_FLUXY_E2E_SELF_HOST === "1" || process.env.FLUXY_E2E_SELF_HOST === "1"
  );
}

/** Clerk publishable key present (browser + ClerkProvider). */
export function hasClerkPublishableKey(): boolean {
  if (isE2eSelfHost()) return false;
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
}

/** Full Clerk stack (Provider + middleware + server API routes). */
export function isClerkEnabled(): boolean {
  return Boolean(hasClerkPublishableKey() && process.env.CLERK_SECRET_KEY?.trim());
}
