"use client";

import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import { HOSTED_COPY, HOSTED_PATHS, hostedSignupRedirect, isClerkClientConfigured } from "@/lib/hosted-product";

const signupRedirect = hostedSignupRedirect();

export function GetStartedAuthCta() {
  if (isClerkClientConfigured()) {
    return (
      <>
        <SignUpButton mode="redirect" forceRedirectUrl={signupRedirect}>
          <Button type="button">{HOSTED_COPY.startFree}</Button>
        </SignUpButton>
        <SignInButton mode="redirect" forceRedirectUrl={signupRedirect}>
          <Button type="button" variant="outline">
            {HOSTED_COPY.signIn}
          </Button>
        </SignInButton>
      </>
    );
  }

  return (
    <Button asChild>
      <Link href={HOSTED_PATHS.onboarding}>{HOSTED_COPY.connectAccount}</Link>
    </Button>
  );
}
