"use client";

import { useCallback, useEffect, useRef } from "react";
import { createEmpathyProsodyController, type ProsodySignal } from "@fluxy-chat/sdk";
import { postProsodySignal } from "@/lib/room-empathy-client";

interface UseEmpathyProsodyOptions {
  enabled: boolean;
  token: string;
  roomId: string;
  userId: string;
  intervalMs?: number;
  onSignal?: (signal: ProsodySignal) => void;
}

/**
 * Captures mic energy samples, classifies prosody client-side, posts ephemeral signal to Worker KV.
 * Never surfaces inferred state in UI — silent adaptation only (#46).
 */
export function useEmpathyProsody({
  enabled,
  token,
  roomId,
  userId,
  intervalMs = 400,
  onSignal,
}: UseEmpathyProsodyOptions) {
  const controllerRef = useRef<ReturnType<typeof createEmpathyProsodyController> | null>(null);
  const lastPostedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !token || !roomId || !userId || typeof window === "undefined") return;

    controllerRef.current = createEmpathyProsodyController({ roomId, userId });
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let stream: MediaStream | null = null;
    let lastTs = performance.now();

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        audioContext = new AudioContext();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        intervalId = setInterval(() => {
          if (!analyser || !controllerRef.current) return;
          const now = performance.now();
          const deltaMs = Math.max(1, now - lastTs);
          lastTs = now;
          const data = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const energy = Math.min(1, Math.sqrt(sum / data.length) * 3);
          const signal = controllerRef.current.ingest({ energy, deltaMs });
          if (!signal) return;
          onSignal?.(signal);
          const key = `${signal.inferredState}:${signal.confidence}`;
          if (lastPostedRef.current === key) return;
          lastPostedRef.current = key;
          void postProsodySignal(token, roomId, {
            turnId: signal.turnId,
            pitchVariance: signal.pitchVariance,
            speechRate: signal.speechRate,
            pauseRatio: signal.pauseRatio,
            inferredState: signal.inferredState,
            confidence: signal.confidence,
          }).catch(() => undefined);
        }, intervalMs);
      } catch {
        /* mic unavailable */
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      source?.disconnect();
      void audioContext?.close();
      stream?.getTracks().forEach((t) => t.stop());
      controllerRef.current = null;
      lastPostedRef.current = null;
    };
  }, [enabled, token, roomId, userId, intervalMs, onSignal]);
}
