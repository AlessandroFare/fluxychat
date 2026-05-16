/** Clerk publishable key present (browser + ClerkProvider). */
export function hasClerkPublishableKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim());
}

/** Full Clerk stack (Provider + middleware + server API routes). */
export function isClerkEnabled(): boolean {
  return Boolean(hasClerkPublishableKey() && process.env.CLERK_SECRET_KEY?.trim());
}
