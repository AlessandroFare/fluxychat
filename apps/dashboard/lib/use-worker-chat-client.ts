"use client";

import { useMemo } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { useDashboardSession } from "@/app/components/dashboard-session";

/** Authenticated FluxyChatClient for dashboard Worker API calls. */
export function useWorkerChatClient(userId = "console"): FluxyChatClient | null {
  const { memberJwt, adminJwt } = useDashboardSession();
  const token = (adminJwt || memberJwt).trim();

  return useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({
      baseUrl: getPublicWorkerUrl(),
      userId,
      token,
    });
  }, [token, userId]);
}
