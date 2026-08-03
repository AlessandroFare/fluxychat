"use client";

import { useEffect, useRef } from "react";
import { audioLevelFromPcmBuffer } from "@fluxy-chat/sdk";

interface UseVoiceStageVadOptions {
  enabled: boolean;
  onScore: (score: number) => void;
  intervalMs?: number;
}

/**
 * Lightweight mic analyser for active-speaker detection on voice stages.
 * Uses energy-based scoring (Silero-compatible API path via PCM levels).
 */
export function useVoiceStageVad({ enabled, onScore, intervalMs = 450 }: UseVoiceStageVadOptions) {
  const streamRef = useRef<MediaStream | null>(null);
  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        const buffer = new ArrayBuffer(analyser.fftSize * 2);

        intervalId = setInterval(() => {
          if (!analyser) return;
          const data = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(data);
          const pcm = new Int16Array(buffer.byteLength / 2);
          for (let i = 0; i < pcm.length; i++) {
            pcm[i] = (data[i] - 128) * 256;
          }
          const level = audioLevelFromPcmBuffer(pcm.buffer);
          const score = Math.min(1, level * 4);
          onScoreRef.current(score);
        }, intervalMs);
      } catch {
        /* mic denied or unavailable */
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      source?.disconnect();
      void audioContext?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [enabled, intervalMs]);
}
