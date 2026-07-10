"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";

export type ShowcaseSessionStatus = "loading" | "ready" | "unavailable";

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
}

/**
 * Guest session for the realtime feature showcase.
 *
 * Reuses the Worker's `/demo/session` endpoint (same as /demo) so every
 * showcase panel runs REAL SDK calls against a live room — no Clerk signup
 * required. When the endpoint is not configured on the Worker the panels
 * degrade to an "unavailable" state instead of mocking data.
 */
export function useShowcaseSession(): ShowcaseSession {
  const workerUrl = getPublicWorkerUrl();
  const [session, setSession] = useState<DemoSessionResponse | null>(null);
  const [status, setStatus] = useState<ShowcaseSessionStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`${workerUrl}/demo/session`);
      const body = (await res.json()) as DemoSessionResponse & { error?: string };
      if (!res.ok || !body.enabled) {
        setStatus("unavailable");
        setError(body.error ?? "Live demo session not configured on this deployment.");
        return;
      }
      setSession(body);
      setStatus("ready");
    } catch {
      setStatus("unavailable");
      setError("Could not reach the Worker demo endpoint.");
    }
  }, [workerUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const client = useMemo(() => {
    if (!session?.token || !session.userId) return null;
    return new FluxyChatClient({
      baseUrl: workerUrl,
      userId: session.userId,
      token: session.token,
    });
  }, [session, workerUrl]);

  return {
    status,
    roomId: session?.roomId ?? null,
    userId: session?.userId ?? null,
    client,
    readOnly: session?.readOnly === true,
    error,
    retry: () => void load(),
  };
}
