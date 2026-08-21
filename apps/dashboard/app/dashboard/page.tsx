"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useClerkUser } from "@/lib/clerk-user";
import { ArrowRight, CheckCircle2, Circle, ExternalLink, KeyRound, MinusCircle, UserPlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { NotificationsOverviewCard } from "../components/notifications-overview-card";
import { InboxOverviewCard } from "../components/inbox-overview-card";
import { useConsoleSetupPhase, useDashboardSession } from "../components/dashboard-session";
import { CONSOLE_NAV_BUILD, CONSOLE_NAV_OPERATE, CONSOLE_NAV_PLATFORM } from "../components/console-nav";
import { filterDashboardNavItems, isDashboardNavHrefVisible } from "@/lib/dashboard-feature-flags";
import { WorkerHealthCard } from "../components/worker-health-card";
import { SloOverviewCard } from "../components/slo-overview-card";
import { ReadinessBadge } from "~/components/ui/readiness-badge";
import { listIndustryReadiness } from "@/lib/readiness-display";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { useQuickstartHref } from "@/lib/use-quickstart-href";
import {
  isQuickstartComplete,
  loadQuickstartProgress,
  type QuickstartProgress,
} from "@/lib/quickstart-progress";
import { cn } from "@/lib/utils";

const CHECKLIST = [
  { key: "project", label: "Create your first project" },
  { key: "member", label: "Mint a member token" },
  { key: "room", label: "Create or open a room" },
  { key: "message", label: "Send your first message" },
  { key: "install", label: "Install the SDK in your app" },
  { key: "invite", label: "Invite a teammate" },
] as const;

export default function DashboardOverviewPage() {
  const phase = useConsoleSetupPhase();
  const quickstartHref = useQuickstartHref();
  const { user, isSignedIn } = useClerkUser();
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
    project: Boolean(activeProject?.id),
    member: memberJwt.trim().length >= 12,
    room: Boolean(lastRoom?.id),
    message:
      Boolean(progress.firstMessageSent || progress.completedAt) &&
      progress.clerkUserId === activeClerkId,
    install: false,
    invite: false,
  };

  const primaryCta = quickstartComplete
    ? { href: "/rooms", label: "Open rooms" }
    : { href: HOSTED_PATHS.onboarding, label: "Continue quickstart" };
  const operateLinks = filterDashboardNavItems(CONSOLE_NAV_OPERATE);
  const platformLinks = filterDashboardNavItems(CONSOLE_NAV_PLATFORM);
  const industryLinks = listIndustryReadiness().filter((entry) => isDashboardNavHrefVisible(entry.href));

  return (
    <ConsoleShell>
      <ConsolePageHeader
        description={
          <>
            Run your tenant: projects, rooms, agents, and billing. First time here? Start the{" "}
            <Link href={quickstartHref} className="font-medium text-primary underline-offset-2 hover:underline">
              quickstart
            </Link>
            . Self-hosting notes live in{" "}
            <Link
              href={`${HOSTED_PATHS.getStarted}#self-host`}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              get started
            </Link>
            .
          </>
        }
      />

      <WorkerHealthCard />
      <SloOverviewCard />

      <section className="mb-8 rounded-2xl border border-black/[0.06] bg-white/90 p-5 shadow-[var(--shadow-subtle-2)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-base font-semibold text-slate-900">Session</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {quickstartComplete && activeProject
                ? `Quickstart complete · ${activeProject.name}`
                : phase === "ready" && activeProject
                  ? `Signed in · ${activeProject.name}. Finish the quickstart to use the console.`
                  : phase === "jwt_only"
                    ? "JWT saved. Pick a project in the quickstart."
                    : "Run the quickstart to connect and send a first message"}
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
            const unknown = item.key === "install" || item.key === "invite";
            const firstOpenIndex = CHECKLIST.findIndex(
              (c) => !checklistDone[c.key] && c.key !== "install" && c.key !== "invite",
            );
            const isCurrent =
              !quickstartComplete &&
              !done &&
              !unknown &&
              CHECKLIST.findIndex((c) => c.key === item.key) === firstOpenIndex;
            return (
              <li
                key={item.key}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border border-transparent px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between",
                  unknown && "border-black/[0.04] bg-slate-50/80",
                )}
              >
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  ) : unknown ? (
                    <MinusCircle className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  ) : (
                    <Circle
                      className={cn("h-4 w-4 shrink-0", isCurrent ? "text-primary" : "text-slate-600")}
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      done
                        ? "text-slate-700"
                        : isCurrent
                          ? "font-medium text-slate-900"
                          : "text-slate-600",
                    )}
                  >
                    {item.label}
                  </span>
                </div>
                {item.key === "install" ? (
                  <Button asChild variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 text-xs">
                    <a
                      href="https://www.npmjs.com/package/@fluxy-chat/sdk"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Install SDK
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  </Button>
                ) : null}
                {item.key === "invite" ? (
                  <Button asChild variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 text-xs">
                    <Link href="/projects" title="Invite teammates via Clerk organization members">
                      <UserPlus className="h-3 w-3" aria-hidden />
                      Invite teammate
                    </Link>
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
        {!quickstartComplete ? (
          <p className="mt-3 text-xs text-muted-foreground">
            <Link href={quickstartHref} className="font-medium text-primary underline-offset-2 hover:underline">
              Open quickstart
            </Link>{" "}
            to finish setup before using the rest of the console.
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Revisit the tutorial anytime via{" "}
            <Link href={quickstartHref} className="font-medium text-primary underline-offset-2 hover:underline">
              quickstart (review)
            </Link>
            .
          </p>
        )}
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />
          Requests use Bearer JWTs to your Worker. The optional{" "}
          <code className="rounded bg-white px-1 py-0.5 font-mono text-[11px]">/enter</code> screen is an ack only; it
          does not replace API keys or JWTs.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-heading text-sm font-semibold text-slate-900">Operate</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Webhooks, moderation, analytics, privacy, and billing: day-two operator tools.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {operateLinks.map((item) => (
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

      <NotificationsOverviewCard />
      <InboxOverviewCard />

      <section>
        <h2 className="mb-3 font-heading text-sm font-semibold text-slate-900">Quick links</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Use the navigation menu for full console access. Evaluating Fluxychat?
          <Link href={HOSTED_PATHS.landing} className="ml-1 font-medium text-primary underline-offset-4 hover:underline">
            Product and pricing
          </Link>
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CONSOLE_NAV_BUILD.filter((item) => item.href !== HOSTED_PATHS.console).map((item) => (
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

      {industryLinks.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 font-heading text-sm font-semibold text-slate-900">Industry studios</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Test vertical workflows built on the shared room kernel. Each studio runs live SDK demos with honest readiness labels.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {industryLinks.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={entry.href}
                  className="block rounded-xl border border-black/[0.06] bg-white/80 px-4 py-3 text-sm transition hover:border-primary/20 hover:shadow-sm"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{entry.label}</span>
                    <ReadinessBadge label={entry.readinessLabel} />
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{entry.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {platformLinks.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 font-heading text-sm font-semibold text-slate-900">Platform modules</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {platformLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-xl border border-dashed border-black/[0.12] bg-slate-50/80 px-4 py-3 text-sm transition hover:border-primary/20 hover:bg-white/80"
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
      ) : null}
    </ConsoleShell>
  );
}
