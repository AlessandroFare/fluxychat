"use client";

import { Loader2 } from "lucide-react";
import { FluxyChat } from "@/components/chat";
import {
  FeatureCodePanel,
  FeaturePreviewFrame,
  ShowcaseUnavailable,
} from "./feature-code-panel";
import { getRealtimeFeature } from "./realtime-feature-content";
import type { ShowcaseSession } from "./use-showcase-session";

const feature = getRealtimeFeature("chat");

export function InAppChatShowcase({ session }: { session: ShowcaseSession }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
      <FeatureCodePanel feature={feature} />

      <FeaturePreviewFrame label="Live in-app chat preview" className="min-h-[28rem]">
        {session.status === "loading" ? (
          <div className="flex h-full min-h-64 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            <span className="sr-only">Connecting to the live demo room</span>
          </div>
        ) : session.status === "unavailable" || !session.client || !session.roomId ? (
          <ShowcaseUnavailable error={session.error} onRetry={session.retry} />
        ) : (
          <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300 p-3">
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--fluxy-cta-color)]/60 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-[var(--fluxy-cta-color)]" />
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                Live · Worker demo room
              </span>
            </div>
            <FluxyChat
              roomId={session.roomId}
              agentId=""
              agentName="Agent"
              client={session.client}
              variant="minimal"
            />
          </div>
        )}
      </FeaturePreviewFrame>
    </div>
  );
}