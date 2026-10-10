"use client";

import { useCallback, useState } from "react";

export interface LiveKitTokenResponse {
  provider: string;
  token?: string;
  url?: string | null;
  roomName?: string;
  identity?: string;
  expiresAt?: number;
  stub?: boolean;
  note?: string;
}

export interface UseLiveKitTokenOptions {
  workerUrl: string;
  /** Admin path `/admin/calls/token`. Prefer `token` + member room path. */
  adminJwt?: string;
  /** Member JWT — LiveKit TokenSource HOW (`POST /rooms/:id/voice/token`). */
  token?: string;
  roomId: string;
  roomName?: string;
  displayName?: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
}

export interface UseLiveKitTokenResult {
  token: LiveKitTokenResponse | null;
  isLoading: boolean;
  error: string | null;
  fetchToken: () => Promise<LiveKitTokenResponse | null>;
}

/** Fetch a LiveKit access token from POST /admin/calls/token (Worker mints JWT when configured). */
export function useLiveKitToken(options: UseLiveKitTokenOptions): UseLiveKitTokenResult {
  const [token, setToken] = useState<LiveKitTokenResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchToken = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const jwt = options.token || options.adminJwt;
      if (!jwt) throw new Error("token or adminJwt required");
      const path = options.token
        ? `/rooms/${encodeURIComponent(options.roomId)}/voice/token`
        : "/admin/calls/token";
      const res = await fetch(`${options.workerUrl.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          provider: "livekit",
          roomId: options.roomId,
          roomName: options.roomName,
          displayName: options.displayName,
          canPublish: options.canPublish,
          canSubscribe: options.canSubscribe,
        }),
      });
      const data = (await res.json()) as { token?: LiveKitTokenResponse; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const payload = data.token ?? null;
      setToken(payload);
      return payload;
    } catch (err) {
      const message = err instanceof Error ? err.message : "token_fetch_failed";
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [options.adminJwt, options.canPublish, options.canSubscribe, options.displayName, options.roomId, options.roomName, options.token, options.workerUrl]);

  return { token, isLoading, error, fetchToken };
}
