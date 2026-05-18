"use client";

import { useCallback, useMemo } from "react";
import {
  FluxyRealtimeProvider,
  decodeFluxyJwtPayload,
  jwtRefreshDelayMs,
  type FluxyAuthTokenResult,
} from "@fluxy-chat/sdk";
import { useClerkUser } from "@/lib/clerk-user";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { isClerkClientConfigured } from "@/lib/hosted-product";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { useDashboardSession } from "./dashboard-session";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Supplies `FluxyRealtimeProvider` for console pages: refreshes member JWT via
 * `/api/fluxy/connect` (hosted) or reuses a pasted member JWT (self-host).
 */
export function FluxyRealtimeShell({ children }: { children: React.ReactNode }) {
  const workerUrl = getPublicWorkerUrl();
  const { hasHydrated, memberJwt, setMemberJwt, setAdminJwt } = useDashboardSession();
  const { user, isSignedIn, isLoaded } = useClerkUser();
  const clerkHosted = isClerkClientConfigured();

  const resolvedUserId = useMemo(() => {
    if (clerkHosted && user?.id) return fluxyUserIdFromClerk(user.id);
    return "dashboard";
  }, [clerkHosted, user?.id]);

  const authTokenProvider = useCallback(async (): Promise<FluxyAuthTokenResult> => {
    const cached = memberJwt.trim();
    if (cached.length >= 12) {
      const claims = decodeFluxyJwtPayload(cached);
      if (claims.exp && jwtRefreshDelayMs(claims.exp, REFRESH_BUFFER_MS) > 0) {
        return {
          token: cached,
          userId: claims.sub?.trim() || resolvedUserId,
        };
      }
    }

    if (clerkHosted && isSignedIn) {
      const res = await fetch("/api/fluxy/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        adminJwt?: string;
        memberJwt?: string;
        memberUserId?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? `Connect failed (${res.status})`);
      }
      if (json.adminJwt) setAdminJwt(json.adminJwt);
      if (!json.memberJwt?.trim()) {
        throw new Error("Connect response did not include memberJwt");
      }
      setMemberJwt(json.memberJwt);
      return {
        token: json.memberJwt,
        userId: json.memberUserId?.trim() || resolvedUserId,
      };
    }

    if (cached.length >= 12) {
      return { token: cached, userId: resolvedUserId };
    }

    throw new Error("Fluxy member JWT required. Complete Quickstart or paste a JWT in Projects.");
  }, [clerkHosted, isSignedIn, memberJwt, resolvedUserId, setAdminJwt, setMemberJwt]);

  const shouldWrap =
    hasHydrated &&
    Boolean(workerUrl) &&
    (memberJwt.trim().length >= 12 || (clerkHosted && isLoaded && isSignedIn));

  if (!shouldWrap) {
    return <>{children}</>;
  }

  return (
    <FluxyRealtimeProvider
      workerUrl={workerUrl}
      authTokenProvider={authTokenProvider}
      userId={resolvedUserId}
      refreshBufferMs={REFRESH_BUFFER_MS}
    >
      {children}
    </FluxyRealtimeProvider>
  );
}
