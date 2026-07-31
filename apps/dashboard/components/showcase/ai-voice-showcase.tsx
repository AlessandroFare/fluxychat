"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Radio } from "lucide-react";
import { createDurableAITransport } from "@fluxy-chat/sdk";
import { createVoiceInterfaceManager } from "@fluxy-chat/sdk";
import { FeatureCodePanel, FeaturePreviewFrame, ShowcaseUnavailable } from "@/components/showcase/feature-code-panel";
import { getRealtimeFeature } from "@/components/showcase/realtime-feature-content";
import type { ShowcaseSession } from "@/components/showcase/use-showcase-session";

interface Props {
  session: ShowcaseSession;
}

interface LogEntry {
  id: number;
  text: string;
}

function useLog(limit = 6) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const nextId = useRef(0);
  const push = (text: string) =>
    setEntries((prev) => [{ id: nextId.current++, text }, ...prev].slice(0, limit));
  return { entries, push };
}

function LogList({ entries, placeholder }: { entries: LogEntry[]; placeholder: string }) {
  return (
    <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">{placeholder}</p>
      ) : (
        entries.map((e) => (
          <p
            key={e.id}
            className="animate-in fade-in-0 slide-in-from-top-1 truncate text-xs text-muted-foreground duration-300"
          >
            {e.text}
          </p>
        ))
      )}
    </div>
  );
}

/** Small tap/press feedback wrapper so demo buttons feel alive, not just hover states. */
function pressable(extra?: string) {
  return `active:scale-95 transition-transform duration-150 ${extra ?? ""}`;
}

export function AiTransportShowcase({ session }: Props) {
  const feature = getRealtimeFeature("ai-transport");
  const dt = useMemo(() => createDurableAITransport(), []);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);
  const { entries, push } = useLog();

  if (session.status === "unavailable") return <ShowcaseUnavailable error={session.error} onRetry={session.retry} />;
  if (session.status === "loading") return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Connecting demo session...</div>;

  const bump = () => {
    setPulse(true);
    window.setTimeout(() => setPulse(false), 260);
  };

  return (
    <div className="grid min-w-0 gap-6 overflow-x-hidden lg:grid-cols-2">
      <FeatureCodePanel feature={feature} />
      <FeaturePreviewFrame>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Durable AI session</span>
            <span
              key={sessionId ?? "none"}
              className={`animate-in fade-in-0 zoom-in-95 duration-300 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                sessionId
                  ? "bg-[var(--fluxy-cta-color)]/10 text-[var(--fluxy-cta-color)]"
                  : "border border-border text-muted-foreground"
              }`}
            >
              <span className="relative flex size-1.5">
                {sessionId ? (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--fluxy-cta-color)]/70 opacity-75 motion-reduce:animate-none" />
                ) : null}
                <span className={`relative inline-flex size-1.5 rounded-full ${sessionId ? "bg-[var(--fluxy-cta-color)]" : "bg-muted-foreground/50"}`} />
              </span>
              {sessionId ? `Active · ${sessionId.slice(0, 8)}` : "No session"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className={pressable("rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90")}
              onClick={() => {
                const s = dt.createSession("demo-user", { deviceId: "browser" });
                setSessionId(s.id);
                push(`Session ${s.id} created`);
                bump();
              }}
            >
              Create session
            </button>
            <button
              className={pressable("rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50")}
              disabled={!sessionId}
              onClick={() => {
                if (!sessionId) return;
                const s = dt.getSession(sessionId);
                if (!s) { push("Session expired"); return; }
                dt.appendEvent(s.id, "message", { text: "ping" });
                push("Event appended");
                bump();
              }}
            >
              Append event
            </button>
            <button
              className={pressable("rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50")}
              disabled={!sessionId}
              onClick={() => {
                if (!sessionId) return;
                const s = dt.getSession(sessionId);
                if (!s) { push("Session expired"); return; }
                const events = dt.replay(s.id);
                push(`Replay: ${events.length} event(s)`);
                bump();
              }}
            >
              Replay events
            </button>
          </div>

          <div className={`h-0.5 origin-left rounded-full bg-[var(--fluxy-cta-color)] transition-transform duration-300 ${pulse ? "scale-x-100" : "scale-x-0"}`} />

          <LogList entries={entries} placeholder="Click buttons to interact" />
        </div>
      </FeaturePreviewFrame>
    </div>
  );
}

/** Animated bar-graph that reacts to listening state with a light, organic wobble. */
function VoiceWaveform({ active }: { active: boolean }) {
  const bars = useMemo(() => Array.from({ length: 20 }, (_, i) => i), []);
  return (
    <div className="flex h-10 items-center gap-0.5" aria-hidden>
      {bars.map((i) => (
        <span
          key={i}
          className="w-full flex-1 rounded-full bg-[var(--fluxy-cta-color)] transition-[height,opacity] duration-300 ease-out"
          style={{
            height: active ? `${22 + Math.sin(i * 0.9) * 14 + (i % 4) * 6}%` : "10%",
            opacity: active ? 0.55 + (i % 3) * 0.15 : 0.25,
            animation: active ? `fluxy-voice-bar ${0.7 + (i % 5) * 0.12}s ease-in-out infinite` : undefined,
            animationDelay: active ? `${i * 40}ms` : undefined,
          }}
        />
      ))}
      <style>{`
        @keyframes fluxy-voice-bar {
          0%, 100% { transform: scaleY(0.7); }
          50% { transform: scaleY(1.25); }
        }
      `}</style>
    </div>
  );
}

export function VoiceInterfaceShowcase({ session }: Props) {
  const feature = getRealtimeFeature("voice");
  const vi = useMemo(() => createVoiceInterfaceManager(), []);
  const [mode, setMode] = useState("push_to_talk");
  const [listening, setListening] = useState(false);
  const { entries, push } = useLog();

  if (session.status === "unavailable") return <ShowcaseUnavailable error={session.error} onRetry={session.retry} />;
  if (session.status === "loading") return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Connecting demo session...</div>;

  return (
    <div className="grid min-w-0 gap-6 overflow-x-hidden lg:grid-cols-2">
      <FeatureCodePanel feature={feature} />
      <FeaturePreviewFrame>
        <div className="space-y-3 p-4">
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs transition-colors"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              vi.setMode(e.target.value as any);
            }}
          >
            <option value="push_to_talk">Push to Talk</option>
            <option value="always_listening">Always Listening</option>
            <option value="voice_activity_detection">Voice Activity Detection</option>
          </select>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <span
              className={`relative flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                listening ? "bg-[var(--fluxy-cta-color)] text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {listening ? (
                <span className="absolute inset-0 -m-1.5 animate-ping rounded-full bg-[var(--fluxy-cta-color)]/40 motion-reduce:animate-none" />
              ) : null}
              {listening ? <Mic className="relative size-4" aria-hidden /> : <MicOff className="relative size-4" aria-hidden />}
            </span>
            <VoiceWaveform active={listening} />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className={pressable(
                `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  listening ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`,
              )}
              onClick={() => {
                vi.startListening();
                setListening(true);
                push("Listening started");
              }}
            >
              <Radio className={`size-3 ${listening ? "animate-pulse" : ""}`} aria-hidden />
              Start listening
            </button>
            <button
              className={pressable("rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50")}
              disabled={!listening}
              onClick={() => {
                vi.stopListening();
                setListening(false);
                push("Listening stopped");
              }}
            >
              Stop listening
            </button>
            <button
              className={pressable("rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted")}
              onClick={() => {
                const cmd = vi.submitTranscript("send message to #general");
                push(`Transcript: "${cmd.text}"`);
              }}
            >
              Submit transcript
            </button>
          </div>

          <LogList entries={entries} placeholder="Voice state will appear here" />
        </div>
      </FeaturePreviewFrame>
    </div>
  );
}