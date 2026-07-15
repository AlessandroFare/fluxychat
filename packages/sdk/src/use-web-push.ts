"use client";

import React from "react";
import type { FluxyChatClient } from "./index";

export type WebPushPermissionState =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

export interface WebPushSubscriptionRow {
  id: string;
  endpointHost: string;
  endpointPreview: string;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
  lastSentAt: string | null;
  failureCount: number;
}

export interface UseWebPushOptions {
  projectId?: string;
  swPath?: string;
  /**
   * Auto-unsubscribe the local browser subscription when the server reports
   * the endpoint is gone (404/410) after delivery. Defaults to `true`.
   */
  autoUnsubscribeOnGone?: boolean;
}

/**
 * Browser-only React hook for VAPID Web Push.
 *
 * Mirrors `useNotifications` style: returns the current permission state,
 * registered subscriptions, a `requestPermissionAndSubscribe()` action,
 * and a `unsubscribe()` action. Safe to use in SSR — it bails out of any
 * `window` access until mount.
 *
 * The actual VAPID subscription lives in the browser; this hook just
 * keeps the worker in sync with the local `PushSubscription`.
 */
export function useWebPush(
  client: FluxyChatClient | null,
  options: UseWebPushOptions = {},
) {
  const [permission, setPermission] = React.useState<WebPushPermissionState>(
    "default",
  );
  const [supported, setSupported] = React.useState(false);
  const [subscribed, setSubscribed] = React.useState(false);
  const [subscriptions, setSubscriptions] = React.useState<
    WebPushSubscriptionRow[]
  >([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const getRegistration = React.useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return null;
    }
    const existing = await navigator.serviceWorker.getRegistration(options.swPath);
    if (existing || !options.swPath) {
      return existing ?? navigator.serviceWorker.ready;
    }
    // Registration is owned by this hook so consumers cannot accidentally
    // register the same worker twice during mount/remount cycles.
    return navigator.serviceWorker.register(options.swPath);
  }, [options.swPath]);

  const refreshLocalSubscription = React.useCallback(async () => {
    const registration = await getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    setSubscribed(Boolean(subscription));
    return subscription ?? null;
  }, [getRegistration]);

  // Detect browser support, permission, and the actual local subscription.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      setPermission("unsupported");
      return;
    }
    let active = true;
    setSupported(true);
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission as WebPushPermissionState);
    }
    void refreshLocalSubscription().catch(() => {
      if (active) setSubscribed(false);
    });
    return () => {
      active = false;
    };
  }, [refreshLocalSubscription]);

  const reload = React.useCallback(async () => {
    if (!client?.isAuthenticated()) {
      setSubscriptions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { subscriptions: rows } = await client.listWebPushSubscriptions();
      setSubscriptions(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [client]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const requestPermissionAndSubscribe = React.useCallback(async (): Promise<
    { ok: true } | { ok: false; error: string }
  > => {
    if (!client?.isAuthenticated()) {
      return { ok: false, error: "not_authenticated" };
    }
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return { ok: false, error: "web_push_not_supported" };
    }
    setLoading(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as WebPushPermissionState);
      if (perm !== "granted") {
        return { ok: false, error: "permission_denied" };
      }
      const reg = await getRegistration();
      if (!reg) return { ok: false, error: "no_service_worker" };
      const { publicKey } = await client.getVapidPublicKey(options.projectId);
      const rawKey = urlBase64ToUint8Array(publicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: rawKey.buffer.slice(
          rawKey.byteOffset,
          rawKey.byteOffset + rawKey.byteLength,
        ) as ArrayBuffer,
      });
      const result = await client.registerWebPush(sub, {
        projectId: options.projectId,
        userAgent: navigator.userAgent,
      });
      if (!result.ok) {
        return { ok: false, error: "register_failed" };
      }
      setSubscribed(true);
      await reload();
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [client, getRegistration, options.projectId, reload]);

  const unsubscribe = React.useCallback(
    async (identifier?: string): Promise<{ ok: boolean }> => {
      if (!client?.isAuthenticated()) return { ok: false };
      try {
        if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
          const local = await refreshLocalSubscription();
          const idToRemove =
            identifier || (local ? JSON.stringify({ endpoint: local.endpoint }) : null);
          if (idToRemove) await client.unregisterWebPush(idToRemove);
          if (local && !identifier) await local.unsubscribe();
          await refreshLocalSubscription();
        } else if (identifier) {
          await client.unregisterWebPush(identifier);
        }
        await reload();
        return { ok: true };
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return { ok: false };
      }
    },
    [client, refreshLocalSubscription, reload],
  );

  return {
    supported,
    permission,
    subscribed,
    subscriptions,
    loading,
    error,
    requestPermissionAndSubscribe,
    unsubscribe,
    reload,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
  return out;
}

