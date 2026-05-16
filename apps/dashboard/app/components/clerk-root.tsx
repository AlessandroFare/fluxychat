"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { clerkAuthAppearance, clerkLocalization } from "@/lib/clerk-copy";

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
      afterSignOutUrl="/landing"
    >
      {children}
    </ClerkProvider>
  );
}
