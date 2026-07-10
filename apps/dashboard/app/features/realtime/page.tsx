"use client";

import React from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { cn } from "@/lib/utils";
import { useShowcaseSession } from "@/components/showcase/use-showcase-session";
import { InAppChatShowcase } from "@/components/showcase/in-app-chat-showcase";
import { LiveStreamingShowcase } from "@/components/showcase/live-streaming-showcase";
import { PushNotificationsShowcase } from "@/components/showcase/push-notifications-showcase";

type TabId = "chat" | "streaming" | "location" | "push";

const TABS: { id: TabId; label: string }[] = [
  { id: "chat", label: "In-App Chat" },
  { id: "streaming", label: "Live Streaming" },
  { id: "location", label: "Real-Time Location" },
  { id: "push", label: "Push Notifications" },
];

/**
 * Realtime feature showcase — every live preview runs real SDK calls
 * against the Worker demo room (no mocked UI). Real-Time Location is not
 * shipped yet; its tab links to the spec in ROADMAP_REALTIME_FEATURES.md.
 */
export default function RealtimeFeaturesPage() {
  const [tab, setTab] = React.useState<TabId>("chat");
  const session = useShowcaseSession();

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Realtime features"
        description="Live demos powered by real SDK calls against the Worker demo room — messaging, high fan-out pub/sub, and web push."
      />

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Realtime feature demos"
        className="mt-6 flex gap-1 overflow-x-auto border-b border-border"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-[var(--fluxy-cta-color)] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8" role="tabpanel">
        {tab === "chat" ? <InAppChatShowcase session={session} /> : null}
        {tab === "streaming" ? <LiveStreamingShowcase session={session} /> : null}
        {tab === "push" ? <PushNotificationsShowcase session={session} /> : null}
        {tab === "location" ? <LocationRoadmapCard /> : null}
      </div>
    </ConsoleShell>
  );
}

function LocationRoadmapCard() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">
        <MapPin className="size-6 text-[var(--fluxy-cta-color)]" aria-hidden />
      </span>
      <h3 className="text-lg font-semibold text-foreground">
        Real-Time Location is on the roadmap
      </h3>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        FluxyChat supports one-time location attachments today, but continuous
        position streaming (watchPosition {"\u2192"} channel publish) isn&apos;t
        shipped yet. The full spec — API surface, data flow, target packages,
        and open questions — lives in{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          ROADMAP_REALTIME_FEATURES.md
        </code>{" "}
        at the repo root.
      </p>
      <Link
        href="/features"
        className="text-sm font-medium text-[var(--fluxy-cta-color)] underline-offset-4 hover:underline"
      >
        Back to all features
      </Link>
    </div>
  );
}
