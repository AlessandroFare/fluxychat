"use client";

import React from "react";
import type { FluxyChatClient } from "./index";

export type WebPushPermissionState = "unsupported" | "default" | "granted" | "denied";

export interface UseWebPushOptions { projectId?: string; }

export function useWebPush(client: FluxyChatClient | null, options: UseWebPushOptions = {}) {
  const [permission, setPermission] = React.useState<WebPushPermissionState>("default");
  const [supported, setSupported] = React.useState(false);
  const [subscribed, setSubscribed] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setSupported(false); setPermission("unsupported"); return; }
    setSupported(true);
    if (typeof Notification !== "undefined") setPermission(Notification.permission as WebPushPermissionState);
    void (async () => { try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); setSubscribed(Boolean(sub)); } catch {} })();
  }, []);

  const requestPermissionAndSubscribe = React.useCallback(async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!client?.isAuthenticated()) return { ok: false, error: "not_authenticated" };
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return { ok: false, error: "web_push_not_supported" };
    setLoading(true); setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as WebPushPermissionState);
      if (perm !== "granted") return { ok: false, error: "permission_denied" };
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true });
      const result = await client.registerWebPush(sub);
      if (!result.ok) return { ok: false, error: "register_failed" };
      setSubscribed(true);
      return { ok: true };
    } catch (e) { const msg = e instanceof Error ? e.message : String(e); setError(msg); return { ok: false, error: msg }; }
    finally { setLoading(false); }
  }, [client]);

  const unsubscribe = React.useCallback(async (): Promise<{ ok: boolean }> => {
    if (!client?.isAuthenticated()) return { ok: false };
    try { await client.unregisterWebPush(); setSubscribed(false); return { ok: true }; }
    catch { return { ok: false }; }
  }, [client]);

  return { supported, permission, subscribed, loading, error, requestPermissionAndSubscribe, unsubscribe };
}
