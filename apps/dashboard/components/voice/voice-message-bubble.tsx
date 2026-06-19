"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Mic, AlertTriangle, Play, Pause } from "lucide-react";
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

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceMessageBubble({
  message,
  className,
  showTranscription = true,
}: VoiceMessageBubbleProps) {
  if (message.kind !== "voice") return null;
  const audioUrl = resolveMediaUrl(message.audioUrl);
  const status = message.transcriptionStatus ?? "pending";
  const transcription = message.transcription ?? null;

  return (
    <div
      className={cn("flex max-w-full flex-col gap-1 text-sm", className)}
      data-testid="voice-message-bubble"
      data-voice-status={status}
    >
      <VoicePlayer audioUrl={audioUrl} durationMs={message.durationMs} />
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

/**
 * Compact custom audio player. Replaces the native <audio controls> element
 * which rendered oversized and inconsistent across browsers, and misaligned
 * with the sender name in the message list. This player is a single
 * inline-flex row: play/pause button, progress track, and duration —
 * matching the height of a normal text line.
 */
function VoicePlayer({
  audioUrl,
  durationMs,
}: {
  audioUrl: string | null;
  durationMs: number | null | undefined;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [totalSec, setTotalSec] = useState<number | null>(
    durationMs ? durationMs / 1000 : null,
  );

  // Keep playing state in sync with the element (handles end + external pause).
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrentSec(el.currentTime);
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setTotalSec(el.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrentSec(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("durationchange", onMeta);
    el.addEventListener("ended", onEnd);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("durationchange", onMeta);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [audioUrl]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      void el.play().catch(() => {
        /* autoplay rejection — ignore, user can retry */
      });
    }
  }

  function seek(e: React.MouseEvent<HTMLButtonElement>) {
    const el = audioRef.current;
    if (!el || !totalSec) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * totalSec;
    setCurrentSec(el.currentTime);
  }

  const displayTotal = totalSec ?? (durationMs ? durationMs / 1000 : 0);
  const progress = displayTotal > 0 ? Math.min(1, currentSec / displayTotal) : 0;

  return (
    <div
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border px-2 py-1",
        "border-border/60 bg-muted/40",
      )}
    >
      {/* Hidden native element does the actual audio decoding. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        preload="metadata"
        className="hidden"
        data-testid="voice-message-player"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground transition hover:opacity-90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        )}
      >
        {playing ? (
          <Pause className="h-3 w-3" aria-hidden />
        ) : (
          <Play className="ml-0.5 h-3 w-3" aria-hidden />
        )}
      </button>
      {/* Click-to-seek progress track. Fixed width keeps the row compact and
          prevents the bubble from stretching to fill the message column. */}
      <button
        type="button"
        onClick={seek}
        aria-label="Seek voice message"
        className="relative h-1.5 w-24 shrink-0 cursor-pointer rounded-full bg-border/70 sm:w-32"
      >
        <span
          className="absolute left-0 top-0 h-full rounded-full bg-primary"
          style={{ width: `${progress * 100}%` }}
        />
      </button>
      <span
        className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground"
        aria-label={`Duration ${formatDuration(durationMs)}`}
      >
        {formatSeconds(currentSec)} / {formatSeconds(displayTotal)}
      </span>
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
        Transcribing… (requires LLM keys in Agents → LLM keys)
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
