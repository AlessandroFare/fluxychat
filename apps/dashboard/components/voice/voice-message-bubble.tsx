"use client";

import React from "react";
import { AudioLines, Loader2, Mic, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import type { FluxyChatMessage } from "@fluxy-chat/sdk";

function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = getPublicWorkerUrl();
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

export interface VoiceMessageBubbleProps {
  message: FluxyChatMessage;
  className?: string;
  /** When true, render the inline transcription BELOW the player (default true). */
  showTranscription?: boolean;
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "0:00";
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceMessageBubble({
  message,
  className,
  showTranscription = true,
}: VoiceMessageBubbleProps) {
  if (message.kind !== "voice") return null;
  const audioUrl = resolveMediaUrl(message.audioUrl);
  const mimeType = message.audioMimeType ?? "audio/webm";
  const status = message.transcriptionStatus ?? "pending";
  const transcription = message.transcription ?? null;

  return (
    <div
      className={cn(
        "flex max-w-full flex-col gap-1.5 text-sm",
        className,
      )}
      data-testid="voice-message-bubble"
      data-voice-status={status}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-2.5 py-1.5",
          "border-border/60 bg-background/80",
        )}
      >
        <AudioLines
          className="h-3.5 w-3.5 shrink-0 text-brand"
          aria-hidden
        />
        <audio
          src={audioUrl ?? undefined}
          controls
          preload="metadata"
          className="h-7 max-h-7 min-w-0 flex-1"
          data-testid="voice-message-player"
        />
        <span
          className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground"
          aria-label={`Duration ${formatDuration(message.durationMs)}`}
        >
          {formatDuration(message.durationMs)}
        </span>
      </div>
      {showTranscription ? <TranscriptionView status={status} text={transcription} /> : null}
      {!audioUrl ? (
        <p
          className="inline-flex items-center gap-1 text-[11px] text-destructive"
          role="status"
        >
          <Mic className="h-3 w-3" aria-hidden />
          Audio unavailable.
        </p>
      ) : null}
    </div>
  );
}

function TranscriptionView({
  status,
  text,
}: {
  status: "pending" | "done" | "failed" | null | undefined;
  text: string | null;
}) {
  if (status === "pending" || status == null) {
    return (
      <p
        className="inline-flex items-center gap-1.5 text-[11px] italic text-muted-foreground"
        data-testid="voice-transcription-pending"
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Transcribing…
      </p>
    );
  }
  if (status === "failed") {
    return (
      <p
        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
        data-testid="voice-transcription-failed"
      >
        <AlertTriangle className="h-3 w-3 text-amber-600" aria-hidden />
        Transcript unavailable.
      </p>
    );
  }
  // status === "done"
  if (!text) {
    return null;
  }
  return (
    <p
      className="whitespace-pre-wrap break-words text-foreground"
      data-testid="voice-transcription-done"
    >
      {text}
    </p>
  );
}
