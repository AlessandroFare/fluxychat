"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { isDemoTurnstileEnabled } from "@/components/demo-turnstile";

export type ShowcaseSessionStatus = "loading" | "ready" | "unavailable" | "turnstile";

interface DemoStatusResponse {
  ok?: boolean;
  enabled: boolean;
  configured: boolean;
  ready: boolean;
  turnstileRequired?: boolean;
}

interface DemoSessionResponse {
  enabled: boolean;
  roomId: string;
  userId: string;
  token: string;
  expiresIn: number;
  readOnly?: boolean;
}

export interface ShowcaseSession {
  status: ShowcaseSessionStatus;
  roomId: string | null;
  userId: string | null;
  client: FluxyChatClient | null;
  readOnly: boolean;
  error: string | null;
  retry: () => void;
  /** Call after Turnstile succeeds (same flow as /demo). */
  completeTurnstile: (turnstileToken: string) => void;
}

export function useShowcaseSession(): ShowcaseSession {
  const workerUrl = getPublicWorkerUrl();
  const [demoStatus, setDemoStatus] = useState<DemoStatusResponse | null>(null);
  const [session, setSession] = useState<DemoSessionResponse | null>(null);
  const [status, setStatus] = useState<ShowcaseSessionStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadDemoSession = useCallback(
    async (turnstileToken?: string) => {
      setError(null);
      try {
        const usePost = isDemoTurnstileEnabled() || demoStatus?.turnstileRequired;
        const res = await fetch(`${workerUrl}/demo/session`, {
          method: usePost ? "POST" : "GET",
          headers: usePost ? { "Content-Type": "application/json" } : undefined,
          body: usePost && turnstileToken ? JSON.stringify({ turnstileToken }) : undefined,
          cache: "no-store",
        });
        const body = (await res.json()) as DemoSessionResponse & { error?: string };
        if (!res.ok || !body.enabled) {
          setSession(null);
          setStatus("unavailable");
          setError(body.error ?? "Live demo session not configured on this deployment.");
          return;
        }
        setSession(body);
        setStatus("ready");
      } catch (nextError) {
        setSession(null);
        setStatus("unavailable");
        setError(
          nextError instanceof Error && nextError.message
            ? nextError.message
            : "Could not reach the Worker demo endpoint.",
        );
      }
    },
    [demoStatus?.turnstileRequired, workerUrl],
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setStatus("loading");
      setError(null);
      try {
        const res = await fetch(`${workerUrl}/demo/status`, { signal: controller.signal, cache: "no-store" });
        const body = (await res.json()) as DemoStatusResponse;
        if (controller.signal.aborted) return;
        setDemoStatus(body);
        if (!body.ready) {
          setSession(null);
          setStatus("unavailable");
          setError(
            !body.enabled
              ? "Public demo is disabled on this Worker (set DEMO_ENABLED=true)."
              : "Demo room not configured (set DEMO_ROOM_ID and DEMO_API_KEY).",
          );
          return;
        }
        if (isDemoTurnstileEnabled() || body.turnstileRequired) {
          setStatus("turnstile");
          return;
        }
        await loadDemoSession();
      } catch {
        if (controller.signal.aborted) return;
        setStatus("unavailable");
        setError("Could not reach the Worker demo endpoint.");
      }
    })();
    return () => controller.abort();
  }, [loadDemoSession, reloadKey, workerUrl]);

  useEffect(() => {
    if (!session?.expiresIn) return;
    const refreshAfterMs = Math.max(5_000, session.expiresIn * 1_000 - 30_000);
    const timer = setTimeout(() => setReloadKey((key) => key + 1), refreshAfterMs);
    return () => clearTimeout(timer);
  }, [session?.expiresIn]);

  const client = useMemo(() => {
    if (!session?.token || !session.userId) return null;
    return new FluxyChatClient({
      baseUrl: workerUrl,
      userId: session.userId,
      token: session.token,
    });
  }, [session, workerUrl]);

  const completeTurnstile = useCallback(
    (turnstileToken: string) => {
      setStatus("loading");
      void loadDemoSession(turnstileToken);
    },
    [loadDemoSession],
  );

  return {
    status,
    roomId: session?.roomId ?? null,
    userId: session?.userId ?? null,
    client,
    readOnly: session?.readOnly === true,
    error,
    retry: () => setReloadKey((key) => key + 1),
    completeTurnstile,
  };
}
