"use client";

import React from "react";
import { FluxyChatClient } from "./index";
import { decodeFluxyJwtPayload, jwtRefreshDelayMs } from "./jwt-utils";
import { FluxyRealtimeContext, type FluxyRealtimeContextValue } from "./use-fluxy-chat";

export interface FluxyAuthTokenResult {
  token: string;
  userId?: string;
}

export interface FluxyRealtimeProviderProps {
  children: React.ReactNode;
  /** Worker HTTP base URL (e.g. https://api.example.com). */
  workerUrl: string;
  /**
   * Pre-minted member JWT, or a callback that returns one.
   * Use with your backend `POST /auth/token` flow.
   */
  authTokenProvider?: string | (() => Promise<string | FluxyAuthTokenResult>);
  /**
   * Hosted dashboard style: POST to obtain `memberJwt` (default body `{}`).
   * Example: `/api/fluxy/connect` on the Next.js app.
   */
  connectUrl?: string;
  connectRequestInit?: Omit<RequestInit, "method" | "body">;
  /** Fallback user id when the JWT has no `sub` claim. */
  userId?: string;
  /** Refresh this many ms before JWT expiry (default 5 minutes). */
  refreshBufferMs?: number;
  onSessionError?: (error: Error) => void;
}

async function resolveAuthToken(
  provider: string | (() => Promise<string | FluxyAuthTokenResult>),
): Promise<FluxyAuthTokenResult> {
  if (typeof provider === "string") {
    return { token: provider };
  }
  const result = await provider();
  if (typeof result === "string") {
    return { token: result };
  }
  return result;
}

async function fetchConnectSession(
  connectUrl: string,
  init?: Omit<RequestInit, "method" | "body">,
): Promise<FluxyAuthTokenResult> {
  const res = await fetch(connectUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: JSON.stringify({}),
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    memberJwt?: string;
    memberUserId?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? `Connect failed (${res.status})`);
  }
  if (!data.memberJwt?.trim()) {
    throw new Error("Connect response did not include memberJwt");
  }
  return {
    token: data.memberJwt,
    userId: data.memberUserId,
  };
}

export function FluxyRealtimeProvider({
  children,
  workerUrl,
  authTokenProvider,
  connectUrl,
  connectRequestInit,
  userId: userIdProp,
  refreshBufferMs = 5 * 60 * 1000,
  onSessionError,
}: FluxyRealtimeProviderProps) {
  const [token, setToken] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState(userIdProp ?? "");
  const [refreshKey, setRefreshKey] = React.useState(0);
  const isRefreshingRef = React.useRef(false);
  const providerRef = React.useRef(authTokenProvider);
  const connectUrlRef = React.useRef(connectUrl);
  const connectInitRef = React.useRef(connectRequestInit);

  React.useEffect(() => {
    providerRef.current = authTokenProvider;
  });
  React.useEffect(() => {
    connectUrlRef.current = connectUrl;
  });
  React.useEffect(() => {
    connectInitRef.current = connectRequestInit;
  });
  React.useEffect(() => {
    if (userIdProp) setUserId(userIdProp);
  }, [userIdProp]);

  const refreshSession = React.useCallback(() => {
    if (isRefreshingRef.current) return;
    setRefreshKey((k) => k + 1);
  }, []);

  React.useEffect(() => {
    if (!authTokenProvider && !connectUrlRef.current) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      isRefreshingRef.current = true;
      try {
        let session: FluxyAuthTokenResult;
        if (connectUrlRef.current) {
          session = await fetchConnectSession(connectUrlRef.current, connectInitRef.current);
        } else if (providerRef.current) {
          session = await resolveAuthToken(providerRef.current);
        } else {
          return;
        }

        if (cancelled) return;

        setToken(session.token);
        const claims = decodeFluxyJwtPayload(session.token);
        const resolvedUserId = session.userId ?? claims.sub ?? userIdProp ?? "";
        if (resolvedUserId) setUserId(resolvedUserId);

        if (claims.exp && typeof providerRef.current !== "string") {
          const delay = jwtRefreshDelayMs(claims.exp, refreshBufferMs);
          timer = setTimeout(() => {
            if (!cancelled) run();
          }, delay);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        onSessionError?.(error);
      } finally {
        if (!cancelled) isRefreshingRef.current = false;
      }
    };

    void run();

    return () => {
      cancelled = true;
      isRefreshingRef.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [authTokenProvider, connectUrl, connectRequestInit, refreshBufferMs, refreshKey, userIdProp, onSessionError]);

  const client = React.useMemo(() => {
    if (!token?.trim() || !userId.trim()) return null;
    return new FluxyChatClient({
      baseUrl: workerUrl.replace(/\/+$/, ""),
      userId,
      token,
    });
  }, [workerUrl, userId, token]);

  const value = React.useMemo<FluxyRealtimeContextValue>(
    () => ({
      client,
      userId,
      token,
      workerUrl,
      ready: Boolean(client),
      refreshSession,
    }),
    [client, userId, token, workerUrl, refreshSession],
  );

  return <FluxyRealtimeContext.Provider value={value}>{children}</FluxyRealtimeContext.Provider>;
}
