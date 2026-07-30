export type EOTDecision = "continue" | "turn_complete" | "awaiting_input" | "interrupted";

export interface EOTDetector {
  analyze(transcript: string, audioLevel?: number): EOTDecision;
  reset(): void;
}

export function createSemanticEOTDetector(): EOTDetector {
  const turnEndings = ["?", ".", "!", "..."];
  const promptIndicators = ["right?", "okay?", "you know?", "see?"];
  let lastDecision: EOTDecision = "continue";

  return {
    analyze(transcript: string, _audioLevel?: number): EOTDecision {
      const trimmed = transcript.trim();
      if (!trimmed) return "continue";

      const lastChar = trimmed[trimmed.length - 1];
      const lastWord = trimmed.split(/\s+/).pop()?.toLowerCase() ?? "";

      if (promptIndicators.includes(lastWord)) {
        lastDecision = "awaiting_input";
        return "awaiting_input";
      }

      if (lastChar === "?" || trimmed.endsWith("right?") || trimmed.endsWith("okay?")) {
        lastDecision = "awaiting_input";
        return "awaiting_input";
      }

      if (turnEndings.includes(lastChar) && trimmed.length > 3) {
        lastDecision = "turn_complete";
        return "turn_complete";
      }

      lastDecision = "continue";
      return "continue";
    },
    reset() { lastDecision = "continue"; },
  };
}

export interface BackchannelConfig {
  intervalMs: number;
  maxIntervalMs: number;
  audioThreshold: number;
  silenceThresholdMs?: number;
}

export interface BackchannelEvent {
  type: "ack" | "interest" | "encourage";
  timestamp: string;
}

export function createBackchannelDetector(config: Partial<BackchannelConfig> = {}) {
  const { intervalMs = 2000, maxIntervalMs = 8000, audioThreshold = 0.02, silenceThresholdMs = 500 } = config;
  let lastBackchannelAt = 0;
  let speakingSince = 0;
  let silenceSince = 0;

  return {
    analyze(audioLevel: number, isSpeaking: boolean): BackchannelEvent | null {
      const now = Date.now();

      if (isSpeaking) {
        speakingSince = speakingSince || now;
        silenceSince = 0;

        if (audioLevel < audioThreshold) {
          const sinceLast = now - lastBackchannelAt;
          if (sinceLast > maxIntervalMs) {
            lastBackchannelAt = now;
            return { type: "encourage", timestamp: new Date().toISOString() };
          }
        }
        return null;
      }

      silenceSince = silenceSince || now;
      const silenceDuration = now - silenceSince;
      const sinceLast = now - lastBackchannelAt;

      if (silenceDuration >= silenceThresholdMs && sinceLast >= intervalMs) {
        lastBackchannelAt = now;
        const type = audioLevel > audioThreshold ? "interest" : "ack";
        return { type: type as "ack" | "interest", timestamp: new Date().toISOString() };
      }

      return null;
    },
    reset() {
      lastBackchannelAt = Date.now();
      speakingSince = 0;
      silenceSince = 0;
    },
  };
}

export interface BargeInConfig {
  enabled: boolean;
  threshold: number;
  debounceMs: number;
}

export interface BargeInEvent {
  type: "barge_in";
  timestamp: string;
  audioLevel: number;
}

export function createBargeInDetector(config: BargeInConfig = { enabled: true, threshold: 0.15, debounceMs: 300 }) {
  const { threshold, debounceMs } = config;
  let lastBargeInAt = 0;
  let consecutiveSamples = 0;
  const requiredSamples = 3;

  return {
    analyze(audioLevel: number, isAiSpeaking: boolean): BargeInEvent | null {
      if (!isAiSpeaking) return null;

      if (audioLevel > threshold) {
        consecutiveSamples++;
      } else {
        consecutiveSamples = Math.max(0, consecutiveSamples - 1);
      }

      if (consecutiveSamples >= requiredSamples) {
        const now = Date.now();
        if (now - lastBargeInAt > debounceMs) {
          lastBargeInAt = now;
          consecutiveSamples = 0;
          return { type: "barge_in", timestamp: new Date().toISOString(), audioLevel };
        }
      }

      return null;
    },
    reset() {
      lastBargeInAt = 0;
      consecutiveSamples = 0;
    },
  };
}

export interface WebRTCVoiceConfig {
  signalingUrl: string;
  iceServers?: RTCIceServer[];
  audioConstraints?: MediaStreamConstraints["audio"];
}

export function createWebRTCVoiceTransport(config: WebRTCVoiceConfig) {
  const { signalingUrl, iceServers, audioConstraints } = config;
  const peerConnections = new Map<string, RTCPeerConnection>();
  const dataChannels = new Map<string, RTCDataChannel>();
  const mediaStreams = new Map<string, MediaStream>();

  return {
    async connect(sessionId: string): Promise<{
      peerConnection: RTCPeerConnection;
      localStream: MediaStream;
      dataChannel: RTCDataChannel;
    }> {
      const pc = new RTCPeerConnection({ iceServers: iceServers ?? [{ urls: "stun:stun.l.google.com:19302" }] });
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints ?? true });
      for (const track of localStream.getTracks()) {
        pc.addTrack(track, localStream);
      }
      const dc = pc.createDataChannel(`voice-${sessionId}`, { ordered: true });
      peerConnections.set(sessionId, pc);
      dataChannels.set(sessionId, dc);
      mediaStreams.set(sessionId, localStream);
      return { peerConnection: pc, localStream, dataChannel: dc };
    },
    async disconnect(sessionId: string): Promise<void> {
      const dc = dataChannels.get(sessionId);
      if (dc) { dc.close(); dataChannels.delete(sessionId); }
      const ms = mediaStreams.get(sessionId);
      if (ms) { ms.getTracks().forEach((t) => t.stop()); mediaStreams.delete(sessionId); }
      const pc = peerConnections.get(sessionId);
      if (pc) { pc.close(); peerConnections.delete(sessionId); }
    },
    sendData(sessionId: string, data: string): void {
      const dc = dataChannels.get(sessionId);
      if (dc && dc.readyState === "open") dc.send(data);
    },
    getPeerConnection(sessionId: string): RTCPeerConnection | null {
      return peerConnections.get(sessionId) ?? null;
    },
    getLocalStream(sessionId: string): MediaStream | null {
      return mediaStreams.get(sessionId) ?? null;
    },
  };
}
