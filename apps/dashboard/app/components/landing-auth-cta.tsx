"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
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

function dockClassFor(navDocked?: boolean) {
  return navDocked ? "h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm" : undefined;
}

/** Signed-in visitors skip sign-up: the CTA becomes the way into the console. */
function ConsoleCtaButton({ size, className }: { size: "sm" | "lg"; className?: string }) {
  return (
    <Button asChild size={size} className={className}>
      <Link href={HOSTED_PATHS.console} className="gap-1">
        {HOSTED_COPY.openConsole}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </Button>
  );
}

export function LandingNavAuthCta({ navDocked }: { navDocked?: boolean }) {
  if (!isClerkClientConfigured()) return <GuestNavAuthCta navDocked={navDocked} />;
  return <ClerkNavAuthCta navDocked={navDocked} />;
}

function GuestNavAuthCta({ navDocked }: { navDocked?: boolean }) {
  const ctaClass = useMarketingCtaClass();
  return (
    <Button asChild size="sm" className={cn(ctaClass, dockClassFor(navDocked))}>
      <Link href={HOSTED_PATHS.getStarted} className="gap-1">
        {HOSTED_COPY.startFree}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </Button>
  );
}

function ClerkNavAuthCta({ navDocked }: { navDocked?: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
  const ctaClass = useMarketingCtaClass();
  const signInClass = useMarketingSignInClass();
  const dockClass = dockClassFor(navDocked);

  if (isLoaded && isSignedIn) {
    return <ConsoleCtaButton size="sm" className={cn(ctaClass, dockClass)} />;
  }

  return (
    <>
      <SignInButton mode="redirect" forceRedirectUrl={signupRedirect}>
        <Button type="button" size="sm" className={cn(signInClass, dockClass, "hidden sm:inline-flex")}>
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
  if (!isClerkClientConfigured()) return <GuestHeroAuthCta />;
  return <ClerkHeroAuthCta />;
}

function useHeroCtaClass() {
  const ctaClass = useMarketingCtaClass();
  return cn(
    ctaClass,
    "h-[52px] shrink-0 px-8 text-base font-semibold sm:w-auto sm:min-w-[11rem]",
  );
}

function GuestHeroAuthCta() {
  const heroClass = useHeroCtaClass();
  return (
    <Button asChild size="lg" className={heroClass}>
      <Link href={HOSTED_PATHS.getStarted}>{HOSTED_COPY.startFree}</Link>
    </Button>
  );
}

function ClerkHeroAuthCta() {
  const { isLoaded, isSignedIn } = useAuth();
  const heroClass = useHeroCtaClass();

  if (isLoaded && isSignedIn) {
    return <ConsoleCtaButton size="lg" className={heroClass} />;
  }

  return (
    <SignUpButton mode="redirect" forceRedirectUrl={signupRedirect}>
      <Button type="button" size="lg" className={heroClass}>
        {HOSTED_COPY.startFree}
      </Button>
    </SignUpButton>
  );
}
