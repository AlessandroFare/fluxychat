"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import { cn } from "@/lib/utils";
import {
  HOSTED_COPY,
  HOSTED_PATHS,
  hostedSignupRedirect,
  isClerkClientConfigured,
} from "@/lib/hosted-product";

const signupRedirect = hostedSignupRedirect();

export function LandingNavAuthCta({ navDocked }: { navDocked?: boolean }) {
  const dockClass = navDocked ? "h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" : undefined;

  if (!isClerkClientConfigured()) {
    return (
      <Button asChild size="sm" className={cn("shadow-sm", dockClass)}>
        <Link href={HOSTED_PATHS.getStarted} className="gap-1">
          {HOSTED_COPY.startFree}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </Button>
    );
  }

  return (
    <>
      <SignInButton mode="redirect" forceRedirectUrl={signupRedirect}>
        <Button type="button" size="sm" variant="outline" className={dockClass}>
          {HOSTED_COPY.signIn}
        </Button>
      </SignInButton>
      <SignUpButton mode="redirect" forceRedirectUrl={signupRedirect}>
        <Button type="button" size="sm" className={cn("shadow-sm", dockClass)}>
          <span className="hidden sm:inline">{HOSTED_COPY.startFree}</span>
          <span className="sm:hidden">Free</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </SignUpButton>
    </>
  );
}

export function LandingHeroAuthCta() {
  const heroClass =
    "h-[52px] shrink-0 px-8 text-base font-semibold shadow-[0_4px_14px_-2px_rgba(232,69,10,0.45)] sm:w-auto sm:min-w-[11rem]";

  if (!isClerkClientConfigured()) {
    return (
      <Button asChild size="lg" className={heroClass}>
        <Link href={HOSTED_PATHS.getStarted}>{HOSTED_COPY.startFree}</Link>
      </Button>
    );
  }

  return (
    <SignUpButton mode="redirect" forceRedirectUrl={signupRedirect}>
      <Button type="button" size="lg" className={heroClass}>
        {HOSTED_COPY.startFree}
      </Button>
    </SignUpButton>
  );
}
