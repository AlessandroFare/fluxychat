"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { SceneApprovalDecision } from "@/components/chat/scene-approval-card";

export interface DemoReplayMarker {
  durationSec: number;
  replayed: number;
}

interface DemoSceneValue {
  decision: SceneApprovalDecision;
  setDecision: (next: "approved" | "rejected") => void;
  replayDone: boolean;
  replayMarker: DemoReplayMarker | null;
  completeReplay: (marker: DemoReplayMarker) => void;
  presenceDone: boolean;
  markPresenceDone: () => void;
  pingMs: number | null;
  setPingMs: (ms: number | null) => void;
  registerDisconnect: (fn: () => void) => void;
  disconnectAndReplay: () => void;
  registerSend: (fn: (text: string) => void) => void;
  sendPrompt: (text: string) => void;
}

const DemoSceneContext = createContext<DemoSceneValue | null>(null);

export function useDemoScene() {
  return useContext(DemoSceneContext);
}

export function DemoSceneProvider({ children }: { children: React.ReactNode }) {
  const [decision, setDecisionState] = useState<SceneApprovalDecision>(null);
  const [replayDone, setReplayDone] = useState(false);
  const [replayMarker, setReplayMarker] = useState<DemoReplayMarker | null>(null);
  const [presenceDone, setPresenceDone] = useState(false);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const disconnectRef = useRef<(() => void) | null>(null);
  const sendRef = useRef<((text: string) => void) | null>(null);

  const setDecision = useCallback((next: "approved" | "rejected") => {
    setDecisionState(next);
  }, []);

  const value = useMemo<DemoSceneValue>(
    () => ({
      decision,
      setDecision,
      replayDone,
      replayMarker,
      completeReplay: (marker) => {
        setReplayMarker(marker);
        setReplayDone(true);
      },
      presenceDone,
      markPresenceDone: () => setPresenceDone(true),
      pingMs,
      setPingMs,
      registerDisconnect: (fn) => {
        disconnectRef.current = fn;
      },
      disconnectAndReplay: () => {
        disconnectRef.current?.();
      },
      registerSend: (fn) => {
        sendRef.current = fn;
      },
      sendPrompt: (text) => {
        sendRef.current?.(text);
      },
    }),
    [decision, pingMs, presenceDone, replayDone, replayMarker, setDecision],
  );

  return <DemoSceneContext.Provider value={value}>{children}</DemoSceneContext.Provider>;
}
