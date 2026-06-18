"use client";

import Link from "next/link";
import { useClerkUser } from "@/lib/clerk-user";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Banner } from "../components/ui";

/**
 * Settings hub. Groups the things users actually need to find:
 * - Profile (managed by Clerk  link out)
 * - API keys (live in the Worker, surfaced under /projects)
 * - Notifications (live at /notifications)
 * - Danger Zone (project deletion lives on /admin)
 */
export default function SettingsPage() {
  const { user, isSignedIn } = useClerkUser();
  const { activeProject } = useDashboardSession();

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Settings"
        description="Account, project, and notification preferences. Most actions live on a dedicated page; this hub is the index."
      />

      {!isSignedIn ? (
        <Banner variant="info">
          <Link href="/sign-in" className="font-medium underline-offset-2 hover:underline">
            Sign in
          </Link>{" "}
          to manage your account.
        </Banner>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <SettingsCard
          title="Profile"
          description="Name, email, password, and connected accounts are managed by Clerk."
          cta={{ label: "Open profile →", href: "/dashboard" }}
        >
          {user ? (
            <p className="text-sm text-muted-foreground">
              Signed in as <strong>{user.fullName || user.username || user.id}</strong>
              {user.primaryEmailAddress ? <> · {user.primaryEmailAddress.emailAddress}</> : null}
            </p>
          ) : null}
        </SettingsCard>

        <SettingsCard
          title="API keys &amp; project"
          description={
            activeProject
              ? `Active project: ${activeProject.name}. Rotate or copy your API key here.`
              : "Create or pick a project to manage its API key and plan."
          }
          cta={{ label: "Open projects →", href: "/projects" }}
        />

        <SettingsCard
          title="Notifications"
          description="Per-room and per-event preferences. Mentions, DMs, quiet hours."
          cta={{ label: "Open notifications →", href: "/notifications" }}
        />

        <SettingsCard
          title="Danger zone"
          description="Delete a project, revoke API keys, force-expire sessions. These actions are irreversible."
          cta={{ label: "Open admin →", href: "/admin" }}
          danger
        />
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Looking for something else? Check the{" "}
        <Link href="/docs" className="font-medium text-foreground underline-offset-4 hover:underline">
          docs
        </Link>{" "}
        or open the command palette with <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>.
      </p>
    </ConsoleShell>
  );
}

function SettingsCard(props: {
  title: string;
  description: string;
  cta: { label: string; href: string };
  danger?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={
        "rounded-2xl border bg-white/90 p-5 shadow-[var(--shadow-subtle-2)] " +
        (props.danger ? "border-red-200" : "border-black/[0.06]")
      }
    >
      <h2
        className={
          "font-heading text-base font-semibold " +
          (props.danger ? "text-red-700" : "text-slate-900")
        }
      >
        {props.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{props.description}</p>
      {props.children ? <div className="mt-3">{props.children}</div> : null}
      <Link
        href={props.cta.href}
        className={
          "mt-4 inline-flex text-sm font-medium underline-offset-4 hover:underline " +
          (props.danger ? "text-red-700" : "text-primary")
        }
      >
        {props.cta.label}
      </Link>
    </div>
  );
}
