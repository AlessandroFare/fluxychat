"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/app/components/theme-provider";
import {
  HOSTED_COPY,
  HOSTED_PATHS,
  hostedSignupRedirect,
  isClerkClientConfigured,
} from "@/lib/hosted-product";

const signupRedirect = hostedSignupRedirect();

function useMarketingCtaClass() {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme !== "dark";
  return isLight
    ? "border-zinc-950 bg-zinc-950 text-white shadow-none hover:bg-zinc-800 hover:text-white"
    : "border-[var(--mkt-brand)] bg-[var(--mkt-brand)] text-white shadow-none hover:opacity-90 hover:text-white";
}

function useMarketingSignInClass() {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme !== "dark";
  return isLight
    ? "border-transparent bg-transparent text-zinc-900 shadow-none hover:bg-zinc-100 hover:text-zinc-900"
    : "border-white/80 bg-white text-zinc-900 shadow-none hover:bg-zinc-100 hover:text-zinc-900";
}

export function LandingNavAuthCta({ navDocked }: { navDocked?: boolean }) {
  const dockClass = navDocked ? "h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" : undefined;
  const ctaClass = useMarketingCtaClass();
  const signInClass = useMarketingSignInClass();

  if (!isClerkClientConfigured()) {
    return (
      <Button asChild size="sm" className={cn(ctaClass, dockClass)}>
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
        <Button type="button" size="sm" className={cn(signInClass, dockClass)}>
          {HOSTED_COPY.signIn}
        </Button>
      </SignInButton>
      <SignUpButton mode="redirect" forceRedirectUrl={signupRedirect}>
        <Button type="button" size="sm" className={cn(ctaClass, dockClass)}>
          <span className="hidden sm:inline">{HOSTED_COPY.startFree}</span>
          <span className="sm:hidden">Free</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </SignUpButton>
    </>
  );
}

export function LandingHeroAuthCta() {
  const ctaClass = useMarketingCtaClass();
  const heroClass = cn(
    ctaClass,
    "h-[52px] shrink-0 px-8 text-base font-semibold sm:w-auto sm:min-w-[11rem]",
  );

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
