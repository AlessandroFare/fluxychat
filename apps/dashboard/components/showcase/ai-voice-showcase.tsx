"use client";

import { useMemo, useState } from "react";
import { createDurableAITransport } from "@fluxy-chat/sdk";
import { createVoiceInterfaceManager } from "@fluxy-chat/sdk";
import { FeatureCodePanel, FeaturePreviewFrame, ShowcaseUnavailable } from "@/components/showcase/feature-code-panel";
import { getRealtimeFeature } from "@/components/showcase/realtime-feature-content";
import type { ShowcaseSession } from "@/components/showcase/use-showcase-session";

interface Props {
  session: ShowcaseSession;
}

export function AiTransportShowcase({ session }: Props) {
  const feature = getRealtimeFeature("ai-transport");
  const dt = useMemo(() => createDurableAITransport(), []);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  if (session.status === "unavailable") return <ShowcaseUnavailable error={session.error} onRetry={session.retry} />;
  if (session.status === "loading") return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Connecting demo session...</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <FeatureCodePanel feature={feature} />
      <FeaturePreviewFrame>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                const s = dt.createSession("demo-user", { deviceId: "browser" });
                setSessionId(s.id);
                setLog((p) => [`Session ${s.id} created`, ...p]);
              }}>Create session</button>
            <button className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              onClick={() => {
                if (!sessionId) { setLog((p) => ["No session yet — click Create first", ...p]); return; }
                const s = dt.getSession(sessionId);
                if (!s) { setLog((p) => ["Session expired", ...p]); return; }
                dt.appendEvent(s.id, "message", { text: "ping" });
                setLog((p) => ["Event appended", ...p]);
              }}>Append event</button>
            <button className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              onClick={() => {
                if (!sessionId) { setLog((p) => ["No session yet — click Create first", ...p]); return; }
                const s = dt.getSession(sessionId);
                if (!s) { setLog((p) => ["Session expired", ...p]); return; }
                const events = dt.replay(s.id);
                setLog((p) => [`Replay: ${events.length} event(s)`, ...p]);
              }}>Replay events</button>
          </div>
          <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
            {log.length === 0 ? <p className="text-xs text-muted-foreground">Click buttons to interact</p> : log.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
          </div>
        </div>
      </FeaturePreviewFrame>
    </div>
  );
}

export function VoiceInterfaceShowcase({ session }: Props) {
  const feature = getRealtimeFeature("voice");
  const vi = useMemo(() => createVoiceInterfaceManager(), []);
  const [log, setLog] = useState<string[]>([]);
  const [mode, setMode] = useState("push_to_talk");

  if (session.status === "unavailable") return <ShowcaseUnavailable error={session.error} onRetry={session.retry} />;
  if (session.status === "loading") return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Connecting demo session...</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <FeatureCodePanel feature={feature} />
      <FeaturePreviewFrame>
        <div className="space-y-3 p-4">
          <select className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
            value={mode} onChange={(e) => { setMode(e.target.value); vi.setMode(e.target.value as any); }}>
            <option value="push_to_talk">Push to Talk</option>
            <option value="always_listening">Always Listening</option>
            <option value="voice_activity_detection">Voice Activity Detection</option>
          </select>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => { vi.startListening(); setLog((p) => ["Listening started", ...p]); }}>Start listening</button>
            <button className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              onClick={() => { vi.stopListening(); setLog((p) => ["Listening stopped", ...p]); }}>Stop listening</button>
            <button className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              onClick={() => {
                const cmd = vi.submitTranscript("send message to #general");
                setLog((p) => [`Transcript: "${cmd.text}"`, ...p]);
              }}>Submit transcript</button>
          </div>
          <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
            {log.length === 0 ? <p className="text-xs text-muted-foreground">Voice state will appear here</p> : log.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
          </div>
        </div>
      </FeaturePreviewFrame>
    </div>
  );
}
