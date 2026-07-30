"use client";

import Link from "next/link";
import { AlertCircle, DoorOpen, FolderKanban } from "lucide-react";
import { useDashboardSession } from "./dashboard-session";
import { Button } from "~/components/ui/button";

interface ConsoleProjectRoomBarProps {
  /** Show a warning when no active project is selected. */
  requireProject?: boolean;
  /** Show a hint when no room has been used in this session. */
  preferRoom?: boolean;
  /** Optional product-specific note shown when context is complete. */
  hint?: string;
}

export function ConsoleProjectRoomBar({
  requireProject = false,
  preferRoom = false,
  hint,
}: ConsoleProjectRoomBarProps) {
  const { hasHydrated, adminJwt, memberJwt, activeProject, lastRoom } = useDashboardSession();
  const hasToken = Boolean((adminJwt || memberJwt).trim());

  if (!hasHydrated) return null;

  const needsAuth = !hasToken;
  const needsProject = requireProject && !activeProject?.id;
  const needsRoom = preferRoom && !lastRoom?.id;
  const isWarning = needsAuth || needsProject || needsRoom;

  return (
    <div
      className={
        isWarning
          ? "mb-4 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          : "mb-4 flex flex-col gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <div className="flex min-w-0 flex-col gap-1.5 text-sm">
        {needsAuth ? (
          <p className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Sign in and connect a project to persist data to your Worker instead of local demo mode.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <FolderKanban className="size-3.5 shrink-0" aria-hidden />
              Project:{" "}
              {activeProject?.name ? (
                <Link href="/projects" className="font-medium text-foreground underline-offset-2 hover:underline">
                  {activeProject.name}
                </Link>
              ) : (
                <span className="text-amber-700 dark:text-amber-300">none selected</span>
              )}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <DoorOpen className="size-3.5 shrink-0" aria-hidden />
              Room:{" "}
              {lastRoom?.id ? (
                <Link href="/rooms" className="font-mono text-xs font-medium text-foreground underline-offset-2 hover:underline">
                  {lastRoom.name || lastRoom.id}
                </Link>
              ) : (
                <span className="text-muted-foreground">none yet</span>
              )}
            </span>
          </div>
        )}
        {needsProject && hasToken ? (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Select or create a project so Worker APIs scope to your tenant.
          </p>
        ) : null}
        {needsRoom && hasToken && activeProject ? (
          <p className="text-xs text-muted-foreground">
            Open or create a room to attach events from this console to a live thread.
          </p>
        ) : null}
        {!isWarning && hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {needsAuth ? (
          <Button asChild size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        ) : null}
        {!activeProject?.id && hasToken ? (
          <Button asChild size="sm" variant={needsProject ? "default" : "outline"}>
            <Link href="/projects">Projects</Link>
          </Button>
        ) : null}
        {hasToken && activeProject && !lastRoom?.id && preferRoom ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/rooms">Open rooms</Link>
          </Button>
        ) : null}
        {hasToken && lastRoom?.id ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/rooms">Rooms</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
