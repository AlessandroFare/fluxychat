/**
 * P24-9: Text-to-Speech
 * TTS integration for voice output.
 */

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

export interface TTSConfig {
  provider?: "openai" | "elevenlabs" | "google" | "amazon";
  apiKey?: string;
  model?: string;
  defaultVoice?: TTSVoice;
  defaultSpeed?: number;
}

export interface TTSRequest {
  text: string;
  voice?: TTSVoice;
  speed?: number;
  /** Output format */
  format?: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
}

export interface TTSResult {
  audio: ArrayBuffer;
  contentType: string;
  durationMs?: number;
}

export interface TextToSpeech {
  synthesize(request: TTSRequest): Promise<TTSResult>;
  /** Get available voices */
  listVoices(): Promise<Array<{ id: string; name: string; language?: string }>>;
}

export function createTextToSpeech(config?: TTSConfig): TextToSpeech {
  throw new Error("createTextToSpeech not implemented in SDK - use worker runtime");
}

/**
 * Tool definition for TTS.
 */
export const TTS_TOOL: {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<TTSResult>;
} = {} as any;
