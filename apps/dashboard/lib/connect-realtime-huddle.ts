"use client";

import {
  CLOUDFLARE_STUN,
  buildLocalTrackObjects,
  sfuTracksNeedAnswer,
  toRemotePullTracks,
} from "@fluxy-chat/sdk";
import {
  addRealtimeTracks,
  announceHuddleTracks,
  createRealtimeSession,
  getHuddleSfuBudget,
  leaveHuddleRoomTracks,
  listHuddleRoomTracks,
  renegotiateRealtimeSession,
  type HuddleRoomTrack,
} from "@/lib/huddles-client";

export interface RealtimeHuddleHandle {
  localStream: MediaStream;
  pc: RTCPeerConnection;
  leave(): Promise<void>;
}

function waitIceConnected(pc: RTCPeerConnection, timeoutMs = 12000): Promise<void> {
  const ok = pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed";
  if (ok) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("ICE timeout")), timeoutMs);
    function onChange() {
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        window.clearTimeout(timer);
        pc.removeEventListener("iceconnectionstatechange", onChange);
        resolve();
      }
      if (pc.iceConnectionState === "failed") {
        window.clearTimeout(timer);
        pc.removeEventListener("iceconnectionstatechange", onChange);
        reject(new Error("ICE failed"));
      }
    }
    pc.addEventListener("iceconnectionstatechange", onChange);
  });
}

async function applySfuDescription(
  token: string,
  roomId: string,
  sessionId: string,
  pc: RTCPeerConnection,
  result: { requiresImmediateRenegotiation?: boolean; sessionDescription?: RTCSessionDescriptionInit },
) {
  const desc = result.sessionDescription;
  if (!desc?.sdp || !desc.type) return;
  if (desc.type === "answer") {
    await pc.setRemoteDescription(new RTCSessionDescription(desc));
    return;
  }
  if (sfuTracksNeedAnswer(result) || desc.type === "offer") {
    await pc.setRemoteDescription(new RTCSessionDescription(desc));
    await pc.setLocalDescription(await pc.createAnswer());
    if (!pc.localDescription?.sdp) throw new Error("Missing local answer");
    await renegotiateRealtimeSession(token, roomId, sessionId, {
      type: "answer",
      sdp: pc.localDescription.sdp,
    });
  }
}

function groupBySession(tracks: HuddleRoomTrack[]) {
  const map = new Map<string, HuddleRoomTrack[]>();
  for (const track of tracks) {
    const list = map.get(track.session_id) || [];
    list.push(track);
    map.set(track.session_id, list);
  }
  return map;
}

export async function connectRealtimeHuddle(opts: {
  token: string;
  roomId: string;
  videoEnabled: boolean;
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (sessionId: string, stream: MediaStream) => void;
}): Promise<RealtimeHuddleHandle> {
  const { token, roomId } = opts;
  const budget = await getHuddleSfuBudget(token, roomId);
  if (budget.disabled) throw new Error("Huddles are paused (REALTIME_SFU_DISABLED)");
  const videoEnabled = Boolean(opts.videoEnabled && budget.allowVideo);
  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: videoEnabled,
  });
  opts.onLocalStream(localStream);

  const pc = new RTCPeerConnection({
    iceServers: [CLOUDFLARE_STUN],
    bundlePolicy: "max-bundle",
  });

  const transceivers = localStream.getTracks().map((track) =>
    pc.addTransceiver(track, { direction: "sendonly" }),
  );

  const pulled = new Set<string>();
  let pollTimer: number | null = null;
  let sessionTimer: number | null = null;
  let stopped = false;

  pc.addEventListener("track", (event) => {
    const stream = event.streams[0] || new MediaStream([event.track]);
    const sid = event.streams[0]?.id || event.track.id;
    opts.onRemoteStream(sid, stream);
  });

  await pc.setLocalDescription(await pc.createOffer());
  if (!pc.localDescription?.sdp) throw new Error("Missing local offer");
  const created = await createRealtimeSession(token, roomId, {
    type: "offer",
    sdp: pc.localDescription.sdp,
  });
  if (!created.sessionId) throw new Error("SFU session missing");
  if (created.sessionDescription) {
    await pc.setRemoteDescription(new RTCSessionDescription(created.sessionDescription));
  }
  await waitIceConnected(pc);

  const localTracks = buildLocalTrackObjects(transceivers);
  await pc.setLocalDescription(await pc.createOffer());
  if (!pc.localDescription?.sdp) throw new Error("Missing local offer");
  const published = await addRealtimeTracks(token, roomId, created.sessionId, {
    sessionDescription: { type: "offer", sdp: pc.localDescription.sdp },
    tracks: localTracks,
  });
  await applySfuDescription(token, roomId, created.sessionId, pc, published);

  await announceHuddleTracks(token, roomId, {
    sessionId: created.sessionId,
    tracks: localStream.getTracks().map((t) => ({
      trackName: t.id,
      kind: t.kind === "video" ? "video" : "audio",
    })),
  });

  async function pullPeers() {
    if (stopped) return;
    const { tracks } = await listHuddleRoomTracks(token, roomId);
    for (const [sessionId, list] of groupBySession(tracks)) {
      const fresh = list.filter((t) => {
        const key = `${t.session_id}:${t.track_name}`;
        if (pulled.has(key)) return false;
        pulled.add(key);
        return true;
      });
      if (!fresh.length) continue;
      const result = await addRealtimeTracks(token, roomId, created.sessionId, {
        tracks: toRemotePullTracks(
          sessionId,
          fresh.map((t) => ({ trackName: t.track_name })),
        ),
      });
      await applySfuDescription(token, roomId, created.sessionId, pc, result);
      const remote = new MediaStream();
      for (const receiver of pc.getReceivers()) {
        if (receiver.track) remote.addTrack(receiver.track);
      }
      if (remote.getTracks().length) opts.onRemoteStream(sessionId, remote);
    }
  }

  await pullPeers();
  pollTimer = window.setInterval(() => {
    void pullPeers().catch(() => {});
  }, 4000);
  sessionTimer = window.setTimeout(() => {
    void leaveInternal();
  }, Math.max(30, budget.maxSessionSeconds || 1200) * 1000);

  async function leaveInternal() {
    if (stopped) return;
    stopped = true;
    if (pollTimer) window.clearInterval(pollTimer);
    if (sessionTimer) window.clearTimeout(sessionTimer);
    try {
      await leaveHuddleRoomTracks(token, roomId);
    } catch {
      /* still close the PC */
    }
    pc.close();
    localStream.getTracks().forEach((t) => t.stop());
  }

  return {
    localStream,
    pc,
    leave: leaveInternal,
  };
}
