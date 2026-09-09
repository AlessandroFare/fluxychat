"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Video } from "lucide-react";
import { createHuddle } from "@fluxy-chat/sdk";
import { CallButton, CallScreen } from "@fluxy-chat/ui";
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
  getHuddleSfuBudget,
  joinCall,
  listActiveCalls,
  startCall,
  toggleCallRecording,
  type CallSession,
  type CallParticipant as HuddleParticipant,
  type HuddleSfuBudget,
} from "@/lib/huddles-client";
import { connectRealtimeHuddle, type RealtimeHuddleHandle } from "@/lib/connect-realtime-huddle";
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
  const [callParticipants, setCallParticipants] = useState<HuddleParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [displayName, setDisplayName] = useState("Console user");
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [sfuConnected, setSfuConnected] = useState(false);
  const [budget, setBudget] = useState<HuddleSfuBudget | null>(null);
  const huddleMedia = useRef<RealtimeHuddleHandle | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const huddle = useMemo(
    () => createHuddle({
      roomId: roomId || "huddle-demo",
      audioEnabled: true,
      videoEnabled: true,
      screenShareEnabled: true,
      captionsEnabled: true,
      recordingConsent: false,
      maxParticipants: 8,
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

  useEffect(() => {
    if (!token || !roomId.trim()) {
      setBudget(null);
      return;
    }
    void getHuddleSfuBudget(token, roomId.trim())
      .then(setBudget)
      .catch(() => setBudget(null));
  }, [token, roomId]);

  async function refreshParticipants(callId: string) {
    if (!token) return;
    const detail = await getCall(token, callId);
    setCallParticipants(detail.participants ?? []);
  }

  async function handleCreateAndStart() {
    if (!token || !roomId.trim()) return;
    setBusy("create");
    try {
      const created = await createCall(token, { roomId: roomId.trim(), recordingEnabled: false });
      await startCall(token, created.id);
      await joinCall(token, { callId: created.id, displayName });
      setActiveCallId(created.id);
      await refreshParticipants(created.id);
      huddleMedia.current = await connectRealtimeHuddle({
        token,
        roomId: roomId.trim(),
        videoEnabled: !isVideoOff,
        onLocalStream(stream) {
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        },
        onRemoteStream(_sessionId, stream) {
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        },
      });
      setSfuConnected(true);
      setNotice(`Huddle ${created.id} on Realtime SFU`);
      await loadCalls();
    } catch (err) {
      await huddleMedia.current?.leave().catch(() => {});
      huddleMedia.current = null;
      setSfuConnected(false);
      setError(messageFromUnknown(err, "Failed to start huddle"));
    } finally {
      setBusy(null);
    }
  }

  async function handleEnd() {
    if (!token || !activeCallId) return;
    setBusy("end");
    try {
      await huddleMedia.current?.leave();
      huddleMedia.current = null;
      setSfuConnected(false);
      await huddle.leave();
      await endCall(token, activeCallId);
      setActiveCallId(null);
      setCallParticipants([]);
      setIsMuted(false);
      setIsVideoOff(true);
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
    const participants = detail.participants ?? [];
    setCallParticipants(participants);
    setNotice(`${participants.length} participant(s) in call`);
  }

  function handleToggleMute() {
    const stream = huddleMedia.current?.localStream;
    const next = !isMuted;
    stream?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    setIsMuted(next);
    setNotice(next ? "Muted" : "Unmuted");
  }

  function handleToggleVideo() {
    if (!budget?.allowVideo) {
      setNotice("Camera is off until REALTIME_SFU_ALLOW_VIDEO=true on the Worker. It burns the 1 TB faster.");
      return;
    }
    setIsVideoOff((prev) => {
      const next = !prev;
      setNotice(next ? "Camera off" : "Camera on");
      return next;
    });
  }

  async function handleEnableStage() {
    if (!token || !roomId.trim()) return;
    setBusy("stage");
    try {
      await enableVoiceStage(token, roomId.trim(), { maxSpeakers: 5 });
      setNotice("Voice stage enabled. Join from room chat (Stage · Listen / Speak).");
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
        description="Mic over Cloudflare Realtime SFU. We stop huddles before the included 1 TB using our own estimate, not Cloudflare's meter. Camera stays off unless you set REALTIME_SFU_ALLOW_VIDEO=true."
      />
      <ConsoleFeedback error={error} notice={notice} />

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
          <Section title="Start huddle">
            <Panel className="p-4 space-y-3 max-w-xl">
              <RoomPicker token={token} value={roomId} onChange={setRoomId} />
              {budget ? (
                <p className="text-xs text-muted-foreground">
                  This month (estimate): {(budget.bytesUsed / 1e9).toFixed(2)} / {budget.monthlyGbCap} GB.
                  {" "}Max {budget.maxConcurrent} huddles at once, {Math.round(budget.maxSessionSeconds / 60)} min each.
                  {" "}Video {budget.allowVideo ? "allowed" : "blocked"}.
                  {" "}Kill switch: REALTIME_SFU_DISABLED=true.
                </p>
              ) : null}
              <Input placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <CallButton
                  isActive={!!activeCallId}
                  mode="video"
                  disabled={!token || !roomId || !!busy}
                  onStart={() => void handleCreateAndStart()}
                  onEnd={() => void handleEnd()}
                />
                <Button size="sm" variant="outline" disabled={!activeCallId} onClick={() => void handleToggleRecording()}>
                  <Video className="h-3 w-3 mr-1" /> Record
                </Button>
                <Button size="sm" variant="outline" disabled={!token || !roomId || !!busy} onClick={() => void handleEnableStage()}>
                  Enable voice stage
                </Button>
              </div>
              {activeCallId ? (
                <CallScreen
                  className="mt-4"
                  title={`Huddle · ${roomId}`}
                  localUserId={displayName}
                  isMuted={isMuted}
                  isVideoOff={isVideoOff}
                  participants={callParticipants.map((p) => ({
                    userId: p.user_id,
                    displayName: p.display_name ?? p.user_id,
                    isMuted: !p.audio_enabled,
                    isVideoOff: !p.video_enabled,
                  }))}
                  onToggleMute={handleToggleMute}
                  onToggleVideo={handleToggleVideo}
                  onEndCall={() => void handleEnd()}
                  mediaSlot={
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">You</p>
                        <video ref={localVideoRef} autoPlay muted playsInline className="w-full rounded-lg bg-black" />
                      </div>
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">Remote</p>
                        <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded-lg bg-black" />
                      </div>
                    </div>
                  }
                />
              ) : null}
              <p className="text-xs text-muted-foreground">
                Camera is chosen when you join. Mute uses the local mic track.
                {" "}
                <Badge variant="outline">{sfuConnected ? "sfu connected" : huddle.getStatus()}</Badge>
              </p>
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
