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
import {
  getRoomEmpathySettings,
  updateRoomEmpathySettings,
} from "@/lib/room-empathy-client";
import { useEmpathyProsody } from "@/lib/use-empathy-prosody";
import { useClerkUser } from "@/lib/clerk-user";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";

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
  const [pipelineMode, setPipelineMode] = useState<"unified" | "legacy">("unified");
  const [vadBackend, setVadBackend] = useState<"hybrid" | "energy" | "silero">("hybrid");
  const [testText, setTestText] = useState("Hello, what is the weather today?");
  const [empathyEnabled, setEmpathyEnabled] = useState(false);
  const [empathyMinConfidence, setEmpathyMinConfidence] = useState("0.6");
  const [empathyOperatorHint, setEmpathyOperatorHint] = useState<string | null>(null);
  const [onHoldPhrase, setOnHoldPhrase] = useState<string | null>(null);

  const { user: clerkUser } = useClerkUser();
  const empathyUserId = clerkUser?.id ? fluxyUserIdFromClerk(clerkUser.id) : "voice-operator";

  useEmpathyProsody({
    enabled: empathyEnabled && Boolean(token && roomId.trim()),
    token,
    roomId: roomId.trim(),
    userId: empathyUserId,
    onSignal: (signal) => {
      // Operator console hint only; never shown to end users in-room
      const conf = Math.round((signal.confidence || 0) * 100);
      const tone =
        signal.inferredState === "stressed"
          ? "calm pacing"
          : signal.inferredState === "frustrated"
            ? "concise next-step"
            : signal.inferredState === "calm"
              ? "matched pace"
              : "baseline";
      setEmpathyOperatorHint(`Adaptation active: ${tone} · ${conf}%`);
    },
  });

  const voice = useVoice({
    pipelineMode,
    vadBackend,
    noiseSuppression: true,
    echoCancellation: true,
    onMetrics: token && sessionId
      ? (payload) => {
          void recordVoiceAiMetrics(token, {
            sessionId,
            totalLatencyMs: payload.totalLatencyMs,
            stages: payload.stages,
            providerId,
            pipelineMode,
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

  useEffect(() => {
    if (!token || !roomId.trim()) return;
    void getRoomEmpathySettings(token, roomId.trim())
      .then((res) => {
        setEmpathyEnabled(res.settings.enabled);
        setEmpathyMinConfidence(String(res.settings.minConfidence));
      })
      .catch(() => undefined);
  }, [token, roomId]);

  async function handleEmpathyToggle(enabled: boolean) {
    if (!token || !roomId.trim()) return;
    setBusy("empathy");
    try {
      const res = await updateRoomEmpathySettings(token, roomId.trim(), {
        enabled,
        minConfidence: Number(empathyMinConfidence) || 0.6,
        escalateOnStressed: true,
      });
      setEmpathyEnabled(res.settings.enabled);
      setNotice(enabled ? "Empathy layer enabled for room (silent adaptation only)" : "Empathy layer disabled");
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to update empathy settings"));
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateSession() {
    if (!token) return;
    setBusy("session");
    try {
      const session = await createVoiceAiSession(token, {
        providerId,
        roomId: roomId || undefined,
        settings: { pipelineMode },
      });
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
    setNotice(`Pipeline complete in ${voice.latencyMs}ms.`);
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Voice AI pipeline"
        description="Unified multimodal voice (default) or legacy STT→LLM→TTS with OpenAI Realtime and Gemini Live, VAD, barge-in, and latency metrics."
        actions={
          <Badge className={readinessBadgeClass(PLATFORM_READINESS.voice.readiness)}>
            {formatReadinessLabel(PLATFORM_READINESS.voice.readiness)}
          </Badge>
        }
      />
      <ConsoleFeedback error={error} notice={notice} />

      <Panel className="p-4 text-sm text-muted-foreground">
        Voice AI uses your project&apos;s provider keys. OpenAI Realtime and Gemini Live are not included in the hosted Worker secrets.
        Add <code className="rounded bg-muted px-1 py-0.5 text-xs">OPENAI_API_KEY</code> or{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">GOOGLE_AI_API_KEY</code> in project settings or Worker secrets before running live sessions.
      </Panel>

      <Panel className="p-4 text-sm text-muted-foreground">
        Turn detection uses Silero VAD in the browser (WASM). To self-host the ONNX bundle, set{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_SILERO_VAD_WASM_URL</code> in the dashboard env or pass{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">onnxModelUrl</code> to the SDK voice pipeline.
      </Panel>

      {!token && (
        <Panel className="p-4 text-sm text-muted-foreground">
          Admin JWT required. Copy one from <Link href="/projects" className="text-primary underline">Projects</Link>.
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
              <fieldset className="flex flex-wrap gap-3 text-xs">
                <legend className="sr-only">Pipeline mode</legend>
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="pipeline-mode"
                    checked={pipelineMode === "unified"}
                    onChange={() => setPipelineMode("unified")}
                  />
                  Unified (one multimodal call)
                </label>
                <label className="inline-flex cursor-pointer items-center gap-1.5">
                  <input
                    type="radio"
                    name="pipeline-mode"
                    checked={pipelineMode === "legacy"}
                    onChange={() => setPipelineMode("legacy")}
                  />
                  Legacy (STT → LLM → TTS)
                </label>
              </fieldset>
              <fieldset className="flex flex-wrap gap-3 text-xs">
                <legend className="sr-only">VAD backend</legend>
                {(["hybrid", "energy", "silero"] as const).map((mode) => (
                  <label key={mode} className="inline-flex cursor-pointer items-center gap-1.5">
                    <input
                      type="radio"
                      name="vad-backend"
                      checked={vadBackend === mode}
                      onChange={() => setVadBackend(mode)}
                    />
                    VAD {mode}
                  </label>
                ))}
              </fieldset>
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
                Status: {voice.status} · Mode: {voice.pipelineMode} · Transport: {voice.activeTransport} · Latency: {voice.latencyMs}ms
                {voice.lastEvent?.type === "vad" ? (
                  <> · VAD: {voice.lastEvent.vad?.event}</>
                ) : null}
                {voice.metrics.length > 0 ? (
                  <> · Stages: {voice.metrics.map((m) => m.stage).join(" → ")}</>
                ) : null}
              </p>
            </Panel>
          </Section>

          <Section title="Empathy layer" description="Opt-in prosody signals adapt agent tone in the room without showing hints to end users. This console shows adaptation hints for operators only.">
            <Panel className="p-4 space-y-3 max-w-xl">
              <p className="text-xs text-muted-foreground">
                Requires a room ID. Mic samples stay client-side; only classified state + confidence are posted ephemerally (5 min TTL).
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={empathyEnabled}
                  disabled={!token || !roomId.trim() || busy === "empathy"}
                  onChange={(e) => void handleEmpathyToggle(e.target.checked)}
                />
                Enable empathy adaptation for this room
              </label>
              <Input
                value={empathyMinConfidence}
                onChange={(e) => setEmpathyMinConfidence(e.target.value)}
                placeholder="Min confidence (0.5–0.95)"
                disabled={!token || !roomId.trim()}
              />
              {empathyEnabled && empathyOperatorHint ? (
                <p className="rounded border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {empathyOperatorHint}
                </p>
              ) : empathyEnabled ? (
                <p className="text-xs text-muted-foreground">Waiting for prosody signal…</p>
              ) : null}
            </Panel>
          </Section>

          <Section title="Duplex on-hold" description="During tool calls the agent can speak a short on-hold phrase. Barge-in cancels the filler (target under 500ms).">
            <Panel className="p-4 space-y-3 max-w-xl">
              <p className="text-xs text-muted-foreground">
                Configure <code className="rounded bg-muted px-1 py-0.5">onHoldPhrase</code> per tool rule in{" "}
                <Link href="/settings/agent-tools" className="text-primary underline">
                  Agent tool policy
                </Link>
                . Room events use type <code className="rounded bg-muted px-1 py-0.5">agent_on_hold</code>.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setOnHoldPhrase("One moment. I'm looking that up.")
                }
              >
                Preview on-hold phrase
              </Button>
              {onHoldPhrase ? (
                <p className="rounded border border-border bg-muted/40 px-3 py-2 text-sm italic">
                  “{onHoldPhrase}”
                </p>
              ) : null}
            </Panel>
          </Section>
        </div>
      )}
    </ConsoleShell>
  );
}
