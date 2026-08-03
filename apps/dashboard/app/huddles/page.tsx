"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Mic, MicOff, Monitor, Phone, PhoneOff, Video } from "lucide-react";
import { createHuddle } from "@fluxy-chat/sdk";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleFeedback } from "../components/console-feedback";
import { RoomPicker } from "../components/room-picker";
import { Button, Input, Panel, Section } from "../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createCall,
  endCall,
  getCall,
  joinCall,
  listActiveCalls,
  startCall,
  toggleCallRecording,
  type CallSession,
} from "@/lib/huddles-client";
import { enableVoiceStage } from "@/lib/voice-stage-client";

export default function HuddlesPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [calls, setCalls] = useState<CallSession[]>([]);
  const [roomId, setRoomId] = useState("");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Console user");
  const [eventLog, setEventLog] = useState<string[]>([]);

  const huddle = useMemo(
    () => createHuddle({
      roomId: roomId || "huddle-demo",
      audioEnabled: true,
      videoEnabled: true,
      screenShareEnabled: true,
      captionsEnabled: true,
      recordingConsent: false,
      maxParticipants: 25,
    }),
    [roomId],
  );

  useEffect(() => {
    huddle.onEvent((e) => {
      setEventLog((prev) => [`${e.type} @ ${e.timestamp.slice(11, 19)}`, ...prev.slice(0, 14)]);
    });
  }, [huddle]);

  const loadCalls = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await listActiveCalls(token);
      setCalls(res.calls ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load calls"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadCalls();
  }, [loadCalls]);

  async function handleCreateAndStart() {
    if (!token || !roomId.trim()) return;
    setBusy("create");
    try {
      const created = await createCall(token, { roomId: roomId.trim(), provider: "livekit", recordingEnabled: true });
      await startCall(token, created.id);
      await joinCall(token, { callId: created.id, displayName });
      setActiveCallId(created.id);
      await huddle.join();
      setNotice(`Huddle ${created.id} started`);
      await loadCalls();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to start huddle"));
    } finally {
      setBusy(null);
    }
  }

  async function handleEnd() {
    if (!token || !activeCallId) return;
    setBusy("end");
    try {
      await huddle.leave();
      await endCall(token, activeCallId);
      setActiveCallId(null);
      setNotice("Huddle ended");
      await loadCalls();
    } catch (err) {
      setError(messageFromUnknown(err, "End failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleToggleRecording() {
    if (!token || !activeCallId) return;
    huddle.giveRecordingConsent();
    await toggleCallRecording(token, activeCallId, true);
    setNotice("Recording enabled");
  }

  async function handleRefreshCall() {
    if (!token || !activeCallId) return;
    const detail = await getCall(token, activeCallId);
    setNotice(`${detail.participants.length} participant(s) in call`);
  }

  async function handleEnableStage() {
    if (!token || !roomId.trim()) return;
    setBusy("stage");
    try {
      await enableVoiceStage(token, roomId.trim(), { maxSpeakers: 5 });
      setNotice("Voice stage enabled — join from room chat (Stage · Listen / Speak).");
    } catch (err) {
      setError(messageFromUnknown(err, "Enable stage failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Huddles"
        description="Audio/video huddles with screen share, captions, and optional recording (WebRTC + worker call sessions)."
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
          <Section title="Start huddle">
            <Panel className="p-4 space-y-3 max-w-xl">
              <RoomPicker token={token} value={roomId} onChange={setRoomId} />
              <Input placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!token || !roomId || !!busy} onClick={() => void handleCreateAndStart()}>
                  <Phone className="h-3 w-3 mr-1" /> Start huddle
                </Button>
                <Button size="sm" variant="outline" disabled={!activeCallId || !!busy} onClick={() => void handleEnd()}>
                  <PhoneOff className="h-3 w-3 mr-1" /> End
                </Button>
                <Button size="sm" variant="outline" disabled={!activeCallId} onClick={() => { huddle.mute(); setNotice("Muted"); }}>
                  <MicOff className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" disabled={!activeCallId} onClick={() => { huddle.unmute(); setNotice("Unmuted"); }}>
                  <Mic className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" disabled={!activeCallId} onClick={() => void huddle.startScreenShare()}>
                  <Monitor className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" disabled={!activeCallId} onClick={() => void handleToggleRecording()}>
                  <Video className="h-3 w-3 mr-1" /> Record
                </Button>
                <Button size="sm" variant="outline" disabled={!token || !roomId || !!busy} onClick={() => void handleEnableStage()}>
                  Enable voice stage
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Local status: <Badge variant="outline">{huddle.getStatus()}</Badge></p>
            </Panel>
          </Section>

          <Section title={`Active calls (${calls.length})`}>
            <Panel className="p-4 space-y-2">
              {calls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active calls.</p>
              ) : (
                calls.map((c) => (
                  <div key={c.id} className="flex justify-between text-sm border-b border-border pb-2 last:border-0">
                    <span className="font-mono text-xs">{c.id}</span>
                    <span className="text-muted-foreground">room {c.room_id} · {c.status}</span>
                  </div>
                ))
              )}
              {activeCallId ? (
                <Button size="sm" variant="ghost" onClick={() => void handleRefreshCall()}>
                  Refresh participants
                </Button>
              ) : null}
            </Panel>
          </Section>

          {eventLog.length > 0 && (
            <Section title="Local events">
              <Panel className="p-4 max-h-40 overflow-y-auto text-xs font-mono text-muted-foreground space-y-1">
                {eventLog.map((line, i) => <p key={i}>{line}</p>)}
              </Panel>
            </Section>
          )}
        </div>
      )}
    </ConsoleShell>
  );
}
