export type HuddleStatus = "idle" | "connecting" | "connected" | "disconnected";
export type HuddleParticipantStatus = "joined" | "left" | "muted" | "unmuted" | "screen_sharing" | "reconnecting";

export interface HuddleParticipant {
  id: string;
  displayName: string;
  status: HuddleParticipantStatus;
  joinedAt: string;
  isMuted: boolean;
  isScreenSharing: boolean;
  videoEnabled: boolean;
}

export interface HuddleConfig {
  roomId: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenShareEnabled: boolean;
  captionsEnabled: boolean;
  recordingConsent: boolean;
  maxParticipants: number;
  iceServers?: RTCIceServer[];
}

export interface HuddleEvent {
  type: "participant_joined" | "participant_left" | "participant_muted" | "participant_unmuted"
    | "screen_share_started" | "screen_share_stopped" | "captions" | "recording_started" | "recording_stopped"
    | "connection_state_change" | "error";
  participantId?: string;
  data?: unknown;
  timestamp: string;
}

export interface Caption {
  participantId: string;
  text: string;
  timestamp: string;
  isFinal: boolean;
}

export interface Huddle {
  getConfig(): HuddleConfig;
  updateConfig(partial: Partial<HuddleConfig>): void;
  join(): Promise<void>;
  leave(): Promise<void>;
  mute(): void;
  unmute(): void;
  enableVideo(): void;
  disableVideo(): void;
  startScreenShare(): Promise<void>;
  stopScreenShare(): Promise<void>;
  enableCaptions(): void;
  disableCaptions(): void;
  giveRecordingConsent(): void;
  revokeRecordingConsent(): void;
  getParticipants(): HuddleParticipant[];
  getStatus(): HuddleStatus;
  onEvent(callback: (event: HuddleEvent) => void): void;
  getCaptions(): Caption[];
  getLocalStream(): MediaStream | null;
  getScreenShareStream(): MediaStream | null;
  isScreenSharing(): boolean;
}

export function createHuddle(config: HuddleConfig): Huddle {
  let status: HuddleStatus = "idle";
  const participants = new Map<string, HuddleParticipant>();
  const listeners = new Set<(event: HuddleEvent) => void>();
  const captions: Caption[] = [];
  let localStream: MediaStream | null = null;
  let screenStream: MediaStream | null = null;
  let recordingConsented = false;

  function doStopScreenShare() {
    if (!screenStream) return;
    screenStream.getTracks().forEach((t) => t.stop());
    screenStream = null;
    config.screenShareEnabled = false;
    emit({ type: "screen_share_stopped", timestamp: new Date().toISOString() });
  }

  function emit(event: HuddleEvent): void {
    for (const listener of listeners) listener(event);
  }

  return {
    getConfig(): HuddleConfig {
      return { ...config };
    },

    updateConfig(partial: Partial<HuddleConfig>): void {
      Object.assign(config, partial);
    },

    async join(): Promise<void> {
      if (status !== "idle" && status !== "disconnected") return;
      status = "connecting";
      emit({ type: "connection_state_change", timestamp: new Date().toISOString(), data: status });
      try {
        if (config.audioEnabled || config.videoEnabled) {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: config.audioEnabled,
            video: config.videoEnabled,
          });
          localStream = stream;
        }
        status = "connected";
        emit({ type: "connection_state_change", timestamp: new Date().toISOString(), data: status });
      } catch (error) {
        status = "disconnected";
        emit({ type: "error", timestamp: new Date().toISOString(), data: error instanceof Error ? error.message : String(error) });
      }
    },

    async leave(): Promise<void> {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
        localStream = null;
      }
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
        screenStream = null;
      }
      status = "disconnected";
      participants.clear();
      emit({ type: "connection_state_change", timestamp: new Date().toISOString(), data: status });
    },

    mute(): void {
      if (localStream) {
        localStream.getAudioTracks().forEach((t) => { t.enabled = false; });
      }
    },

    unmute(): void {
      if (localStream) {
        localStream.getAudioTracks().forEach((t) => { t.enabled = true; });
      }
    },

    enableVideo(): void {
      config.videoEnabled = true;
    },

    disableVideo(): void {
      config.videoEnabled = false;
    },

    async startScreenShare(): Promise<void> {
      if (screenStream) return;
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: config.audioEnabled,
        });
        screenStream = stream;
        stream.getVideoTracks()[0]?.addEventListener("ended", doStopScreenShare);
        emit({ type: "screen_share_started", timestamp: new Date().toISOString() });
        config.screenShareEnabled = true;
      } catch (err) {
        emit({ type: "error", timestamp: new Date().toISOString(), data: err instanceof Error ? err.message : String(err) });
      }
    },

    async stopScreenShare(): Promise<void> {
      doStopScreenShare();
    },

    enableCaptions(): void {
      config.captionsEnabled = true;
    },

    disableCaptions(): void {
      config.captionsEnabled = false;
    },

    giveRecordingConsent(): void {
      recordingConsented = true;
      emit({ type: "recording_started", timestamp: new Date().toISOString() });
    },

    revokeRecordingConsent(): void {
      recordingConsented = false;
      emit({ type: "recording_stopped", timestamp: new Date().toISOString() });
    },

    getParticipants(): HuddleParticipant[] {
      return [...participants.values()];
    },

    getStatus(): HuddleStatus {
      return status;
    },

    onEvent(callback: (event: HuddleEvent) => void): void {
      listeners.add(callback);
    },

    getCaptions(): Caption[] {
      return [...captions];
    },

    getLocalStream(): MediaStream | null {
      return localStream;
    },

    getScreenShareStream(): MediaStream | null {
      return screenStream;
    },

    isScreenSharing(): boolean {
      return screenStream !== null;
    },
  };
}
