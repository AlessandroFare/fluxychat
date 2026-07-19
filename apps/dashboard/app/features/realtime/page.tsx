"use client";

import React from "react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { cn } from "@/lib/utils";
import { useShowcaseSession } from "@/components/showcase/use-showcase-session";
import { InAppChatShowcase } from "@/components/showcase/in-app-chat-showcase";
import { LiveStreamingShowcase } from "@/components/showcase/live-streaming-showcase";
import { PushNotificationsShowcase } from "@/components/showcase/push-notifications-showcase";
import { RealTimeLocationShowcase } from "@/components/showcase/real-time-location-showcase";
import { AiTransportShowcase, VoiceInterfaceShowcase } from "@/components/showcase/ai-voice-showcase";
import {
  REALTIME_FEATURES,
  type RealtimeFeatureId,
} from "@/components/showcase/realtime-feature-content";

const TABS = REALTIME_FEATURES.map(({ id, label }) => ({ id, label }));

/**
 * Realtime feature showcase — every selected preview runs real SDK calls
 * against the authenticated Worker demo room. Inactive tabs stay unmounted
 * so the page only opens connections for the feature being exercised.
 */
export default function RealtimeFeaturesPage() {
  const [tab, setTab] = React.useState<RealtimeFeatureId>("chat");
  const session = useShowcaseSession();

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Realtime features"
        description="Live SDK demos for room messaging, ephemeral pub/sub, foreground location, and standards-based web push."
      />

      <div
        role="tablist"
        aria-label="Realtime feature demos"
        className="mt-6 flex gap-1 overflow-x-auto border-b border-border"
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const current = TABS.findIndex((item) => item.id === tab);
          const direction = event.key === "ArrowRight" ? 1 : -1;
          const next = TABS[(current + direction + TABS.length) % TABS.length];
          setTab(next.id);
          requestAnimationFrame(() => document.getElementById(`realtime-tab-${next.id}`)?.focus());
        }}
      >
        {TABS.map((item) => (
          <button
            id={`realtime-tab-${item.id}`}
            key={item.id}
            role="tab"
            type="button"
            aria-controls="realtime-feature-panel"
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              tab === item.id
                ? "border-[var(--fluxy-cta-color)] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        id="realtime-feature-panel"
        className="mt-8"
        role="tabpanel"
        aria-labelledby={`realtime-tab-${tab}`}
      >
        {tab === "chat" ? <InAppChatShowcase session={session} /> : null}
        {tab === "streaming" ? <LiveStreamingShowcase session={session} /> : null}
        {tab === "location" ? <RealTimeLocationShowcase session={session} /> : null}
        {tab === "push" ? <PushNotificationsShowcase session={session} /> : null}
        {tab === "ai-transport" ? <AiTransportShowcase session={session} /> : null}
        {tab === "voice" ? <VoiceInterfaceShowcase session={session} /> : null}
      </div>
    </ConsoleShell>
  );
}
