"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Bell, ArrowRight } from "lucide-react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useNotifications } from "@fluxy-chat/react";
import { Button } from "~/components/ui/button";
import { useDashboardSession } from "./dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";

const WORKER_URL = getPublicWorkerUrl();

export function NotificationsOverviewCard() {
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = memberJwt.trim() || adminJwt.trim();

  const client = useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({
      baseUrl: WORKER_URL,
      userId: "console",
      token,
    });
  }, [token]);

  const { unreadCount, loading } = useNotifications(client, {
    limit: 20,
    unreadOnly: true,
    pollMs: 60_000,
  });

  if (!token) return null;

  return (
    <section className="mb-8 rounded-2xl border border-black/[0.06] bg-white/90 p-5 shadow-[var(--shadow-subtle-2)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="font-heading text-base font-semibold text-slate-900">Notifications</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? "Loading…"
                : unreadCount > 0
                  ? `${unreadCount} unread mention or DM alert${unreadCount === 1 ? "" : "s"}`
                  : "No unread alerts. Mentions and DMs show up here"}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 gap-1">
          <Link href="/notifications">
            Open inbox
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}

