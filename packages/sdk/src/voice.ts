/**
 * P23-9: Bidirectional Realtime Voice
 * Real-time voice conversations with tool calling.
 */

export type VoiceStatus = "idle" | "connecting" | "connected" | "speaking" | "listening" | "disconnected";

export interface VoiceConfig {
  /** Voice provider */
  provider?: "openai" | "deepgram" | "elevenlabs" | "google";
  /** API key for the voice provider */
  apiKey?: string;
  /** Voice model */
  model?: string;
  /** Voice ID for TTS */
  voiceId?: string;
  /** Language */
  language?: string;
  /** Sample rate (default: 24000) */
  sampleRate?: number;
  /** Enable tool calling during voice conversations */
  enableToolCalls?: boolean;
  /** Noise reduction */
  noiseReduction?: boolean;
}

export interface VoiceChunk {
  type: "audio" | "transcript" | "tool_call" | "tool_result" | "error";
  audio?: ArrayBuffer;
  transcript?: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  error?: string;
}

export interface VoiceSession {
  id: string;
  status: VoiceStatus;
  config: VoiceConfig;
  /** Start the voice session */
  start(): Promise<void>;
  /** Stop the voice session */
  stop(): Promise<void>;
  /** Send audio data to the session */
  sendAudio(audio: ArrayBuffer): Promise<void>;
  /** Send a text message during voice session */
  sendText(text: string): Promise<void>;
  /** Subscribe to voice chunks */
  onChunk(callback: (chunk: VoiceChunk) => void): void;
  /** Get session status */
  getStatus(): VoiceStatus;
}

export interface VoiceManager {
  /** Create a voice session */
  createSession(config?: VoiceConfig): Promise<VoiceSession>;
  /** Get an active session */
  getSession(id: string): VoiceSession | null;
  /** List active sessions */
  listSessions(): VoiceSession[];
  /** Stop a session */
  stopSession(id: string): Promise<void>;
  /** Stop all sessions */
  stopAll(): Promise<void>;
}

export declare function createVoiceManager(): VoiceManager;

/**
 * Convert audio ArrayBuffer to base64.
 */
export declare function audioToBase64(audio: ArrayBuffer): string;

/**
 * Convert base64 to audio ArrayBuffer.
 */
export declare function base64ToAudio(base64: string): ArrayBuffer;
