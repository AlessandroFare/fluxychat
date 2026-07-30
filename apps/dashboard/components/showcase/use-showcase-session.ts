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

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const load = async () => {
      setStatus("loading");
      setError(null);
      try {
        const res = await fetch(`${workerUrl}/demo/session`, {
          signal: controller.signal,
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

        // Refresh before the guest token expires so open showcase tabs keep
        // their authenticated realtime connection without a hard failure.
        const refreshAfterMs = Math.max(5_000, body.expiresIn * 1_000 - 30_000);
        refreshTimer = setTimeout(() => setReloadKey((key) => key + 1), refreshAfterMs);
      } catch (nextError) {
        if (controller.signal.aborted) return;
        setSession(null);
        setStatus("unavailable");
        setError(
          nextError instanceof Error && nextError.message
            ? nextError.message
            : "Could not reach the Worker demo endpoint.",
        );
      }
    };

    void load();
    return () => {
      controller.abort();
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [reloadKey, workerUrl]);

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
    retry: () => setReloadKey((key) => key + 1),
  };
}
