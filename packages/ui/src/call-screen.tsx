"use client";

import * as React from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { cn } from "./lib/utils";
import { Button } from "./primitives/button";

export interface CallParticipant {
  userId: string;
  displayName?: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isActiveSpeaker?: boolean;
}

export interface CallScreenProps {
  title?: string;
  participants: CallParticipant[];
  localUserId?: string;
  isMuted?: boolean;
  isVideoOff?: boolean;
  className?: string;
  onToggleMute?: () => void;
  onToggleVideo?: () => void;
  onEndCall?: () => void;
  /** Optional slot for LiveKit / custom media renderer */
  mediaSlot?: React.ReactNode;
}

/**
 * CP-063: Full-screen or embedded call UI shell (LiveKit/voice stage compatible).
 */
export function CallScreen({
  title = "Call",
  participants,
  localUserId,
  isMuted = false,
  isVideoOff = true,
  className,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  mediaSlot,
}: CallScreenProps) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-border bg-background shadow-lg",
        className,
      )}
      data-testid="call-screen"
      aria-label={title}
    >
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{participants.length} in call</span>
      </header>

      <div className="relative min-h-[200px] flex-1 p-4">
        {mediaSlot ?? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {participants.map((p) => (
              <li
                key={p.userId}
                className={cn(
                  "rounded-lg border px-3 py-4 text-center text-sm",
                  p.isActiveSpeaker ? "border-emerald-500/50 bg-emerald-500/5" : "border-border",
                )}
              >
                <span className="font-medium">{p.displayName || p.userId}</span>
                {p.userId === localUserId ? (
                  <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex items-center justify-center gap-2 border-t border-border px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={isMuted ? "Unmute" : "Mute"}
          onClick={onToggleMute}
        >
          {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={isVideoOff ? "Turn camera on" : "Turn camera off"}
          onClick={onToggleVideo}
        >
          {isVideoOff ? <VideoOff className="size-4" /> : <Video className="size-4" />}
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          aria-label="End call"
          onClick={onEndCall}
        >
          <PhoneOff className="size-4" />
        </Button>
      </footer>
    </section>
  );
}
