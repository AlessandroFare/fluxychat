"use client";

import { Headphones, Mic, MicOff, Radio, UserPlus } from "lucide-react";
import type { VoiceStageSnapshot, VoiceStageRole } from "@fluxy-chat/sdk";
import { findStageParticipant } from "@fluxy-chat/sdk";
import { cn } from "@/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "@/app/components/ui";

interface VoiceStagePanelProps {
  stage: VoiceStageSnapshot;
  currentUserId: string;
  className?: string;
  onJoin: (role: VoiceStageRole) => void;
  onLeave: () => void;
  onPromote: (targetUserId: string) => void;
}

export function VoiceStagePanel({
  stage,
  currentUserId,
  className,
  onJoin,
  onLeave,
  onPromote,
}: VoiceStagePanelProps) {
  const self = findStageParticipant(stage, currentUserId);
  const speakers = stage.participants.filter((p) => p.role === "speaker");
  const listeners = stage.participants.filter((p) => p.role === "listener");

  return (
    <section
      className={cn(
        "rounded-lg border border-emerald-500/25 bg-gradient-to-b from-emerald-500/5 to-background shadow-sm",
        className,
      )}
      data-testid="voice-stage-panel"
      aria-label="Voice stage"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border/50 px-3 py-2">
        <Radio className="size-4 text-emerald-600" aria-hidden />
        <h3 className="text-xs font-semibold uppercase tracking-wide">Voice stage</h3>
        <Badge variant="secondary" className="text-[10px]">
          {stage.speakerCount} speakers · {stage.listenerCount} listening
        </Badge>
        {!self ? (
          <div className="ml-auto flex gap-1">
            <Button type="button" size="sm" variant="outline" onClick={() => onJoin("listener")}>
              <Headphones className="mr-1 h-3 w-3" /> Listen
            </Button>
            <Button type="button" size="sm" onClick={() => onJoin("speaker")}>
              <Mic className="mr-1 h-3 w-3" /> Speak
            </Button>
          </div>
        ) : (
          <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={onLeave}>
            <MicOff className="mr-1 h-3 w-3" /> Leave stage
          </Button>
        )}
      </header>

      <div className="grid gap-3 px-3 py-2 md:grid-cols-2">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Speakers</p>
          <ul className="space-y-1">
            {speakers.length === 0 ? (
              <li className="text-xs text-muted-foreground">No speakers yet.</li>
            ) : (
              speakers.map((p) => (
                <li
                  key={p.userId}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-2 py-1 text-xs",
                    p.isActiveSpeaker ? "border-emerald-400/60 bg-emerald-500/10" : "border-border/60",
                  )}
                >
                  <span className="truncate font-medium">{p.displayName || p.userId}</span>
                  {p.isActiveSpeaker ? (
                    <Badge className="text-[9px]">Active</Badge>
                  ) : self?.role === "speaker" && p.role === "listener" ? null : null}
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Listeners</p>
          <ul className="space-y-1">
            {listeners.length === 0 ? (
              <li className="text-xs text-muted-foreground">No listeners.</li>
            ) : (
              listeners.map((p) => (
                <li
                  key={p.userId}
                  className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1 text-xs"
                >
                  <span className="truncate">{p.displayName || p.userId}</span>
                  {self?.role === "speaker" ? (
                    <button
                      type="button"
                      className="text-[10px] text-brand underline"
                      onClick={() => onPromote(p.userId)}
                    >
                      <UserPlus className="mr-0.5 inline h-3 w-3" />
                      Promote
                    </button>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}
