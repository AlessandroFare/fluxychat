"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Mic, Play, Square } from "lucide-react";
import { useVoice } from "@fluxy-chat/react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleFeedback } from "../components/console-feedback";
import { RoomPicker } from "../components/room-picker";
import { Button, Input, Panel, Section } from "../components/ui";
import { formatReadinessLabel, readinessBadgeClass } from "@/lib/readiness-display";
import { PLATFORM_READINESS } from "@fluxy-chat/sdk";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createVoiceAiSession,
  getVoiceAiStats,
  listVoiceAiProviders,
  recordVoiceAiMetrics,
  type VoiceAiProvider,
  type VoiceAiStats,
} from "@/lib/voice-ai-client";

export default function VoiceAiPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [providers, setProviders] = useState<VoiceAiProvider[]>([]);
  const [stats, setStats] = useState<VoiceAiStats | null>(null);
  const [providerId, setProviderId] = useState("openai-realtime");
  const [roomId, setRoomId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [testText, setTestText] = useState("Hello, what is the weather today?");

  const voice = useVoice({
    noiseSuppression: true,
    echoCancellation: true,
    onMetrics: token && sessionId
      ? (payload) => {
          void recordVoiceAiMetrics(token, {
            sessionId,
            totalLatencyMs: payload.totalLatencyMs,
            stages: payload.stages,
            providerId,
          }).then(() => loadStats()).catch(() => undefined);
        }
      : undefined,
  });

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await getVoiceAiStats(token);
      setStats(res.stats);
    } catch {
      /* optional */
    }
  }, [token]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const prov = await listVoiceAiProviders(token || undefined);
      setProviders(prov.providers ?? []);
      if (token) await loadStats();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load voice AI"));
    } finally {
      setLoading(false);
    }
  }, [token, loadStats]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleCreateSession() {
    if (!token) return;
    setBusy("session");
    try {
      const session = await createVoiceAiSession(token, { providerId, roomId: roomId || undefined });
      setSessionId(session.sessionId);
      setNotice(`Session ${session.sessionId} ready (target ${session.targetLatencyMs}ms)`);
    } catch (err) {
      setError(messageFromUnknown(err, "Session creation failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handlePipelineTest() {
    setNotice(null);
    await voice.start();
    await voice.processText(testText);
    setNotice(`Pipeline complete — ${voice.latencyMs}ms total latency`);
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Voice AI pipeline"
        description="OpenAI Realtime and Gemini Live adapters — STT→LLM→TTS metrics with VAD, barge-in, and AEC."
        actions={
          <Badge className={readinessBadgeClass(PLATFORM_READINESS.voice.readiness)}>
            {formatReadinessLabel(PLATFORM_READINESS.voice.readiness)}
          </Badge>
        }
      />
      <ConsoleFeedback error={error} notice={notice} />

      {!token && (
        <Panel className="p-4 text-sm text-muted-foreground">
          Admin JWT required — copy one from <Link href="/projects" className="text-primary underline">Projects</Link>.
        </Panel>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {stats && (
            <div className="grid gap-3 sm:grid-cols-4">
              <Panel className="p-4"><p className="text-xs text-muted-foreground">Samples</p><p className="text-xl font-semibold">{stats.sampleCount}</p></Panel>
              <Panel className="p-4"><p className="text-xs text-muted-foreground">Avg latency</p><p className="text-xl font-semibold">{stats.avgLatencyMs}ms</p></Panel>
              <Panel className="p-4"><p className="text-xs text-muted-foreground">P95</p><p className="text-xl font-semibold">{stats.p95LatencyMs}ms</p></Panel>
              <Panel className="p-4"><p className="text-xs text-muted-foreground">Under 300ms</p><p className="text-xl font-semibold">{stats.under300Ms}</p></Panel>
            </div>
          )}

          <Section title="Providers">
            <div className="grid gap-3 sm:grid-cols-2">
              {providers.map((p) => (
                <Panel key={p.id} className={`p-4 cursor-pointer ${providerId === p.id ? "ring-1 ring-primary" : ""}`} onClick={() => setProviderId(p.id)}>
                  <p className="text-sm font-semibold">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.model} · target {p.targetLatencyMs}ms</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.features.map((f) => <Badge key={f} variant="outline" className="text-[8px]">{f}</Badge>)}
                  </div>
                </Panel>
              ))}
            </div>
          </Section>

          <Section title="Session">
            <Panel className="p-4 space-y-3 max-w-xl">
              <RoomPicker token={token} value={roomId} onChange={setRoomId} allowEmpty emptyLabel="No room" />
              <Button size="sm" disabled={!token || busy === "session"} onClick={() => void handleCreateSession()}>
                {busy === "session" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Mic className="h-3 w-3 mr-1" />}
                Create voice session
              </Button>
              {sessionId && <p className="text-xs font-mono text-muted-foreground">Session: {sessionId}</p>}
            </Panel>
          </Section>

          <Section title="Pipeline test (useVoice hook)">
            <Panel className="p-4 space-y-3 max-w-xl">
              <Input value={testText} onChange={(e) => setTestText(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void handlePipelineTest()} disabled={voice.status === "running"}>
                  <Play className="h-3 w-3 mr-1" /> Run pipeline
                </Button>
                <Button size="sm" variant="outline" onClick={() => void voice.stop()}>
                  <Square className="h-3 w-3 mr-1" /> Stop
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Status: {voice.status} · Transport: {voice.activeTransport} · Latency: {voice.latencyMs}ms
                {voice.activeTransport === "text_only" ? " · demo fallback (see docs/platform/voice)" : ""}
              </p>
            </Panel>
          </Section>
        </div>
      )}
    </ConsoleShell>
  );
}
