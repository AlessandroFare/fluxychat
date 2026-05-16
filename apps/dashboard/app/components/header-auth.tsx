"use client";

import Link from "next/link";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { Button } from "~/components/ui/button";
import { HOSTED_COPY, HOSTED_PATHS, isClerkClientConfigured } from "@/lib/hosted-product";
import { useConsoleSetupPhase, useDashboardSession } from "./dashboard-session";

const clerkOn = isClerkClientConfigured();

export function HeaderAuth() {
  const { activeProject, adminJwt, clearSession } = useDashboardSession();
  const phase = useConsoleSetupPhase();

  const cta =
    phase === "no_jwt"
      ? { href: HOSTED_PATHS.onboarding, label: HOSTED_COPY.connectAccount }
      : phase === "jwt_only"
        ? { href: "/projects", label: "Choose project" }
        : { href: "/rooms", label: "Open rooms" };

  if (clerkOn) {
    return <ClerkHeaderAuth activeProject={activeProject} cta={cta} clearSession={clearSession} />;
  }

  return (
    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
      {activeProject ? (
        <div
          className="hidden max-w-[11rem] truncate rounded-full border border-black/[0.08] bg-white/80 px-2.5 py-1 text-xs text-slate-600 sm:block"
          title={activeProject.name}
        >
          <span className="font-medium text-slate-900">{activeProject.name}</span>
        </div>
      ) : phase === "jwt_only" ? (
        <span className="hidden text-xs text-amber-700 sm:inline">No active project</span>
      ) : null}
      <button
        type="button"
        onClick={clearSession}
        className="hidden text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline sm:inline"
      >
        Clear session
      </button>
      <Button asChild size="sm" className="shrink-0 text-xs sm:text-sm">
        <Link href={cta.href}>{cta.label}</Link>
      </Button>
    </div>
  );
}

function ClerkHeaderAuth({
  activeProject,
  cta,
  clearSession,
}: {
  activeProject: { name: string } | null;
  cta: { href: string; label: string };
  clearSession: () => void;
}) {
  const { isSignedIn } = useUser();
  const { adminJwt } = useDashboardSession();

  return (
    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
      {activeProject ? (
        <div
          className="hidden max-w-[11rem] truncate rounded-full border border-black/[0.08] bg-white/80 px-2.5 py-1 text-xs text-slate-600 sm:block"
          title={activeProject.name}
        >
          <span className="font-medium text-slate-900">{activeProject.name}</span>
        </div>
      ) : null}
      {isSignedIn ? (
        <>
          <Button asChild size="sm" className="shrink-0 text-xs sm:text-sm">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
          <UserButton afterSignOutUrl="/landing" />
          {adminJwt.trim().length >= 12 ? (
            <button
              type="button"
              onClick={clearSession}
              className="hidden text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline sm:inline"
              title="Clear operator JWTs in this tab (Clerk account stays signed in)"
            >
              Clear JWTs
            </button>
          ) : null}
        </>
      ) : (
        <>
          <SignInButton mode="modal">
            <Button size="sm" variant="outline" className="text-xs sm:text-sm">
              Sign in
            </Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button size="sm" className="text-xs sm:text-sm">
              Sign up
            </Button>
          </SignUpButton>
        </>
      )}
    </div>
  );
}
