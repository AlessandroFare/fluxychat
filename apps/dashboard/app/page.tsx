"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { ArrowRight, CheckCircle2, Circle, KeyRound } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ConsoleShell } from "./components/console-shell";
import { ConsolePageHeader } from "./components/console-page-header";
import { useConsoleSetupPhase, useDashboardSession } from "./components/dashboard-session";
import { CONSOLE_NAV_MAIN } from "./components/console-nav";
import { HOSTED_COPY, HOSTED_PATHS, hostedQuickstartReviewHref } from "@/lib/hosted-product";
import {
  isQuickstartComplete,
  loadQuickstartProgress,
  type QuickstartProgress,
} from "@/lib/quickstart-progress";
import { cn } from "@/lib/utils";

const CHECKLIST = [
  { key: "jwt", label: "Admin JWT saved" },
  { key: "project", label: "Project selected" },
  { key: "member", label: "Member JWT minted" },
  { key: "room", label: "Room created" },
  { key: "message", label: "First message sent" },
] as const;

export default function HomePage() {
  const phase = useConsoleSetupPhase();
  const { user, isSignedIn } = useUser();
  const { hasHydrated, clerkUserId, adminJwt, memberJwt, activeProject, lastRoom } = useDashboardSession();
  const [progress, setProgress] = useState<QuickstartProgress>({});

  const activeClerkId = isSignedIn && user?.id ? user.id : null;

  useEffect(() => {
    if (!activeClerkId) {
      setProgress({});
      return;
    }
    setProgress(loadQuickstartProgress(activeClerkId));
  }, [activeClerkId]);

  const quickstartComplete =
    hasHydrated &&
    Boolean(activeClerkId) &&
    clerkUserId === activeClerkId &&
    isQuickstartComplete(
      activeClerkId,
      {
        adminJwt,
        memberJwt,
        activeProjectId: activeProject?.id ?? null,
        lastRoomId: lastRoom?.id ?? null,
      },
      progress,
    );

  const checklistDone = {
    jwt: adminJwt.trim().length >= 12,
    project: Boolean(activeProject?.id),
    member: memberJwt.trim().length >= 12,
    room: Boolean(lastRoom?.id),
    message:
      Boolean(progress.firstMessageSent || progress.completedAt) &&
      progress.clerkUserId === activeClerkId,
  };

  const primaryCta = quickstartComplete
    ? { href: "/rooms", label: "Open rooms" }
    : { href: HOSTED_PATHS.onboarding, label: "Continue quickstart" };

  return (
    <ConsoleShell>
      <ConsolePageHeader
        description={
          <>
            Manage projects, rooms, agents, and billing on Fluxychat Cloud. New here?{" "}
            <Link href={HOSTED_PATHS.getStarted} className="font-medium text-primary underline-offset-2 hover:underline">
              Quickstart
            </Link>
            . Self-hosting is documented under{" "}
            <Link
              href={`${HOSTED_PATHS.getStarted}#self-host`}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              advanced
            </Link>
            .
          </>
        }
      />

      <section className="mb-8 rounded-2xl border border-black/[0.06] bg-white/90 p-5 shadow-[var(--shadow-subtle-2)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-base font-semibold text-slate-900">Session</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {quickstartComplete && activeProject
                ? `Quickstart complete · ${activeProject.name}`
                : phase === "ready" && activeProject
                  ? `Connected · ${activeProject.name} — finish quickstart to unlock overview`
                  : phase === "jwt_only"
                    ? "JWT saved — continue the quickstart wizard"
                    : "Start with the quickstart wizard"}
            </p>
          </div>
          <Button asChild className="gap-1 shrink-0">
            <Link href={primaryCta.href}>
              {primaryCta.label}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
        <ul className="mt-5 space-y-2 border-t border-black/[0.06] pt-4">
          {CHECKLIST.map((item) => {
            const done = checklistDone[item.key];
            const firstOpenIndex = CHECKLIST.findIndex((c) => !checklistDone[c.key]);
            const isCurrent =
              !quickstartComplete &&
              !done &&
              CHECKLIST.findIndex((c) => c.key === item.key) === firstOpenIndex;
            return (
              <li key={item.key} className="flex items-center gap-2 text-sm">
                {done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle
                    className={cn("h-4 w-4 shrink-0", isCurrent ? "text-primary" : "text-slate-300")}
                    aria-hidden
                  />
                )}
                <span className={cn(done ? "text-slate-700" : isCurrent ? "font-medium text-slate-900" : "text-slate-400")}>
                  {item.label}
                </span>
              </li>
            );
          })}
        </ul>
        {!quickstartComplete ? (
          <p className="mt-3 text-xs text-muted-foreground">
            <Link href={HOSTED_PATHS.onboarding} className="font-medium text-primary underline-offset-2 hover:underline">
              Open quickstart
            </Link>{" "}
            to finish setup before using the rest of the console.
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Revisit the tutorial anytime via{" "}
            <Link href={hostedQuickstartReviewHref()} className="font-medium text-primary underline-offset-2 hover:underline">
              quickstart (review)
            </Link>
            .
          </p>
        )}
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          Requests use Bearer JWTs to your Worker. The optional{" "}
          <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">/enter</code> screen is an ack only; it
          does not replace API keys or JWTs.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-sm font-semibold text-slate-900">Quick links</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Use the sidebar on desktop for full navigation.           Evaluating Fluxychat?
          <Link href="/landing" className="ml-1 font-medium text-primary underline-offset-4 hover:underline">
            Product and pricing
          </Link>
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CONSOLE_NAV_MAIN.filter((item) => item.href !== "/").map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-xl border border-black/[0.06] bg-white/80 px-4 py-3 text-sm transition hover:border-primary/20 hover:shadow-sm"
              >
                <span className="font-medium text-slate-900">{item.label}</span>
                {item.description ? (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </ConsoleShell>
  );
}
