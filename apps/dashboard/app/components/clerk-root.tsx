"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { clerkAuthAppearance, clerkLocalization } from "@/lib/clerk-copy";
import { CLERK_SIGN_IN_REDIRECT_URL, CLERK_SIGN_UP_REDIRECT_URL } from "@/lib/clerk-redirects";
import { HOSTED_PATHS } from "@/lib/hosted-product";

interface ClerkRootProps {
  publishableKey: string;
  children: React.ReactNode;
}

export function ClerkRoot({ publishableKey, children }: ClerkRootProps) {
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={clerkAuthAppearance}
      localization={clerkLocalization}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl={CLERK_SIGN_IN_REDIRECT_URL}
      signUpFallbackRedirectUrl={CLERK_SIGN_UP_REDIRECT_URL}
      signInForceRedirectUrl={CLERK_SIGN_IN_REDIRECT_URL}
      signUpForceRedirectUrl={CLERK_SIGN_UP_REDIRECT_URL}
      afterSignOutUrl={HOSTED_PATHS.landing}
    >
      {children}
    </ClerkProvider>
  );
}
