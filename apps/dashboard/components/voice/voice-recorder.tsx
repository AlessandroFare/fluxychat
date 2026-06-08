"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Loader2, Mic, MicOff, Send, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const HARD_CAP_MS = 10 * 60 * 1000 + 1000; // 1s grace

interface VoiceRecorderProps {
  /** Called with the recorded audio blob and measured duration in ms. */
  onSend: (audio: Blob, durationMs: number) => Promise<void> | void;
  /** Disable the mic button. */
  disabled?: boolean;
  /** Compact mode renders a single icon button; full mode renders inline status. */
  variant?: "compact" | "inline";
  /** Optional className for the outer wrapper. */
  className?: string;
}

type Phase =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "permission_denied"; reason: string }
  | { kind: "unsupported" }
  | { kind: "recording"; startedAt: number; elapsedMs: number; level: number }
  | { kind: "reviewing"; blob: Blob; durationMs: number; mimeType: string; url: string }
  | { kind: "sending"; durationMs: number }
  | { kind: "error"; message: string };

function pickRecorderMimeType(): string {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") {
    return "";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
  ];
  for (const c of candidates) {
    try {
      if (window.MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return "";
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({
  onSend,
  disabled = false,
  variant = "inline",
  className,
}: VoiceRecorderProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [isSupported] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return Boolean(
      window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
    );
  });

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelDataRef = useRef<Uint8Array | null>(null);
  const startedAtRef = useRef<number>(0);
  const hardStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopAllTimers = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (levelRef.current) {
      clearInterval(levelRef.current);
      levelRef.current = null;
    }
    if (hardStopTimerRef.current) {
      clearTimeout(hardStopTimerRef.current);
      hardStopTimerRef.current = null;
    }
  }, []);

  const teardownStream = useCallback(() => {
    if (streamRef.current) {
      try {
        for (const track of streamRef.current.getTracks()) track.stop();
      } catch {
        /* ignore */
      }
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        /* ignore */
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    levelDataRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    stopAllTimers();
    if (
      recorderRef.current &&
      recorderRef.current.state !== "inactive"
    ) {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
  }, [stopAllTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      teardownStream();
    };
  }, [stopRecording, teardownStream]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setPhase({ kind: "unsupported" });
      return;
    }
    setPhase({ kind: "requesting" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.addEventListener("dataavailable", (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      });

      recorder.addEventListener("stop", () => {
        stopAllTimers();
        const mime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        const elapsed = Date.now() - startedAtRef.current;
        const url = URL.createObjectURL(blob);
        teardownStream();
        recorderRef.current = null;
        setPhase({
          kind: "reviewing",
          blob,
          durationMs: elapsed,
          mimeType: mime,
          url,
        });
      });

      // Optional audio level meter via Web Audio API
      try {
        const Ctor: typeof AudioContext | undefined =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (Ctor) {
          const ctx = new Ctor();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;
          levelDataRef.current = new Uint8Array(analyser.frequencyBinCount);
        }
      } catch {
        /* level meter is optional */
      }

      startedAtRef.current = Date.now();
      recorder.start(100); // collect chunks every 100ms
      setPhase({
        kind: "recording",
        startedAt: startedAtRef.current,
        elapsedMs: 0,
        level: 0,
      });

      tickRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        setPhase((prev) =>
          prev.kind === "recording"
            ? { ...prev, elapsedMs: elapsed }
            : prev,
        );
        if (elapsed >= MAX_DURATION_MS) {
          stopRecording();
        }
      }, 200);

      levelRef.current = setInterval(() => {
        const analyser = analyserRef.current;
        const data = levelDataRef.current;
        if (!analyser || !data) return;
        analyser.getByteTimeDomainData(data as Uint8Array<ArrayBuffer>);
        let sumSquares = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sumSquares += v * v;
        }
        const rms = Math.sqrt(sumSquares / data.length);
        const level = Math.min(1, rms * 2.4);
        setPhase((prev) =>
          prev.kind === "recording" ? { ...prev, level } : prev,
        );
      }, 100);

      hardStopTimerRef.current = setTimeout(() => stopRecording(), HARD_CAP_MS);
    } catch (err: unknown) {
      stopAllTimers();
      teardownStream();
      const message =
        err instanceof Error ? err.message : "Microphone permission denied.";
      if (/denied|notallowed/i.test(message)) {
        setPhase({
          kind: "permission_denied",
          reason: "Microphone access was denied. Allow it in your browser settings and retry.",
        });
      } else if (/notfound|nomedia/i.test(message)) {
        setPhase({
          kind: "permission_denied",
          reason: "No microphone found. Plug one in and try again.",
        });
      } else {
        setPhase({ kind: "error", message });
      }
    }
  }, [isSupported, stopAllTimers, stopRecording, teardownStream]);

  const cancelReview = useCallback(() => {
    setPhase((prev) => {
      if (prev.kind === "reviewing") {
        try {
          URL.revokeObjectURL(prev.url);
        } catch {
          /* ignore */
        }
      }
      return { kind: "idle" };
    });
  }, []);

  const sendReview = useCallback(async () => {
    if (phase.kind !== "reviewing") return;
    setPhase({ kind: "sending", durationMs: phase.durationMs });
    try {
      await onSend(phase.blob, phase.durationMs);
      try {
        URL.revokeObjectURL(phase.url);
      } catch {
        /* ignore */
      }
      setPhase({ kind: "idle" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send voice message";
      setPhase({ kind: "error", message });
    }
  }, [phase, onSend]);

  const dismissError = useCallback(() => setPhase({ kind: "idle" }), []);

  const recorderBusy = useMemo(
    () => phase.kind === "requesting" || phase.kind === "sending",
    [phase],
  );

  if (!isSupported) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground",
          className,
        )}
        data-testid="voice-recorder-unsupported"
      >
        <MicOff className="h-3.5 w-3.5" aria-hidden />
        <span>Voice messages not supported on this browser.</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <CompactMicButton
        phase={phase}
        disabled={disabled || recorderBusy}
        onStart={startRecording}
        onCancel={cancelReview}
        onSend={sendReview}
        onDismissError={dismissError}
        className={className}
      />
    );
  }

  return (
    <InlineRecorder
      phase={phase}
      disabled={disabled || recorderBusy}
      onStart={startRecording}
      onStop={stopRecording}
      onCancel={cancelReview}
      onSend={sendReview}
      onDismissError={dismissError}
      className={className}
    />
  );
}

interface InlineRecorderProps {
  phase: Phase;
  disabled: boolean;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onSend: () => void;
  onDismissError: () => void;
  className?: string;
}

function InlineRecorder({
  phase,
  disabled,
  onStart,
  onStop,
  onCancel,
  onSend,
  onDismissError,
  className,
}: InlineRecorderProps) {
  return (
    <div className={cn("flex items-center gap-2", className)} data-testid="voice-recorder">
      {phase.kind === "idle" ? (
        <button
          type="button"
          aria-label="Record voice message"
          onClick={onStart}
          disabled={disabled}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors",
            "hover:bg-muted/60 hover:text-foreground",
            "disabled:opacity-50 disabled:pointer-events-none",
          )}
        >
          <Mic className="h-4 w-4" aria-hidden />
        </button>
      ) : null}

      {phase.kind === "requesting" ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Awaiting microphone…
        </span>
      ) : null}

      {phase.kind === "recording" ? (
        <div
          className="flex flex-1 items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-xs"
          data-testid="voice-recorder-active"
        >
          <span className="relative inline-flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/60 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
          </span>
          <span className="font-mono text-foreground tabular-nums">
            {formatDuration(phase.elapsedMs)}
          </span>
          <VoiceLevelMeter level={phase.level} />
          <button
            type="button"
            onClick={onStop}
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-md bg-destructive px-2 text-[11px] font-medium text-destructive-foreground hover:opacity-90"
            aria-label="Stop recording"
          >
            Stop
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label="Discard recording"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {phase.kind === "reviewing" ? (
        <div
          className="flex flex-1 items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs"
          data-testid="voice-recorder-review"
        >
          <AudioLines className="h-3.5 w-3.5 text-brand" aria-hidden />
          <audio
            src={phase.url}
            controls
            className="h-7 max-h-7 flex-1"
            data-testid="voice-recorder-playback"
          />
          <span className="font-mono tabular-nums text-muted-foreground">
            {formatDuration(phase.durationMs)}
          </span>
          <button
            type="button"
            onClick={onSend}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-brand px-2 text-[11px] font-medium text-brand-foreground hover:opacity-90"
            aria-label="Send voice message"
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            Send
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label="Discard recording"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      {phase.kind === "sending" ? (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Sending {formatDuration(phase.durationMs)}…
        </span>
      ) : null}

      {phase.kind === "permission_denied" || phase.kind === "error" ? (
        <div
          className="flex flex-1 items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-xs text-destructive"
          data-testid="voice-recorder-error"
        >
          <span className="flex-1">
            {phase.kind === "permission_denied" ? phase.reason : phase.message}
          </span>
          {phase.kind === "error" ? (
            <button
              type="button"
              onClick={onStart}
              className="rounded-md border border-destructive/30 px-1.5 py-0.5 text-[11px] hover:bg-destructive/10"
            >
              Retry
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismissError}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-destructive/10"
            aria-label="Dismiss error"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface CompactMicButtonProps {
  phase: Phase;
  disabled: boolean;
  onStart: () => void;
  onCancel: () => void;
  onSend: () => void;
  onDismissError: () => void;
  className?: string;
}

function CompactMicButton({
  phase,
  disabled,
  onStart,
  onCancel,
  onSend,
  onDismissError,
  className,
}: CompactMicButtonProps) {
  if (phase.kind === "recording") {
    return (
      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        aria-label="Stop recording"
        data-testid="voice-recorder-active"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10",
          "disabled:opacity-50 disabled:pointer-events-none",
          className,
        )}
      >
        <span className="relative inline-flex h-3 w-3" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive/60 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
        </span>
      </button>
    );
  }
  if (phase.kind === "reviewing") {
    return (
      <button
        type="button"
        onClick={onSend}
        disabled={disabled}
        aria-label="Send voice message"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand text-brand-foreground hover:opacity-90",
          "disabled:opacity-50 disabled:pointer-events-none",
          className,
        )}
      >
        <Send className="h-4 w-4" aria-hidden />
      </button>
    );
  }
  if (phase.kind === "sending") {
    return (
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center text-muted-foreground",
          className,
        )}
        aria-label="Sending voice message"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      </span>
    );
  }
  if (phase.kind === "permission_denied" || phase.kind === "error") {
    return (
      <button
        type="button"
        onClick={phase.kind === "error" ? onSend : onStart}
        disabled={disabled}
        aria-label="Voice recorder error, click to retry"
        data-testid="voice-recorder-error"
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10",
          "disabled:opacity-50 disabled:pointer-events-none",
          className,
        )}
        title={phase.kind === "permission_denied" ? phase.reason : phase.message}
      >
        <MicOff className="h-4 w-4" aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onStart}
      disabled={disabled}
      aria-label="Record voice message"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        "disabled:opacity-50 disabled:pointer-events-none",
        className,
      )}
    >
      <Mic className="h-4 w-4" aria-hidden />
    </button>
  );
}

function VoiceLevelMeter({ level }: { level: number }) {
  const bars = 5;
  const lit = Math.round(level * bars);
  return (
    <div
      className="flex items-end gap-0.5"
      aria-hidden
      data-testid="voice-recorder-level"
    >
      {Array.from({ length: bars }).map((_, i) => {
        const active = i < lit;
        const height = 4 + i * 2;
        return (
          <span
            key={i}
            className={cn(
              "w-0.5 rounded-sm transition-colors",
              active ? "bg-destructive" : "bg-muted-foreground/30",
            )}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}
