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
  const operationInFlight = React.useRef(false);

  // Detect browser support and current permission on mount.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSupported(false);
      setPermission("unsupported");
      return;
    }
    setSupported(true);
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission as WebPushPermissionState);
    }
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration(
          options.swPath,
        );
        const sub = await reg?.pushManager.getSubscription();
        setSubscribed(Boolean(sub));
      } catch {
        // ignore
      }
    })();
  }, [options.swPath]);

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
    if (operationInFlight.current) {
      return { ok: false, error: "operation_in_progress" };
    }
    operationInFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm as WebPushPermissionState);
      if (perm !== "granted") {
        return { ok: false, error: "permission_denied" };
      }
      const reg = options.swPath
        ? await navigator.serviceWorker.getRegistration(options.swPath)
        : await navigator.serviceWorker.ready;
      if (!reg) {
        return { ok: false, error: "no_service_worker" };
      }
      const { publicKey } = await client.getVapidPublicKey(options.projectId);
      const rawKey = urlBase64ToUint8Array(publicKey);
      const applicationServerKey = rawKey.buffer.slice(
        rawKey.byteOffset,
        rawKey.byteOffset + rawKey.byteLength,
      ) as ArrayBuffer;
      const existing = await reg.pushManager.getSubscription();
      if (
        existing?.options.applicationServerKey &&
        !arrayBuffersEqual(existing.options.applicationServerKey, applicationServerKey)
      ) {
        await existing.unsubscribe();
      }
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const result = await client.registerWebPush(sub, {
        projectId: options.projectId,
        userAgent: navigator.userAgent,
      });
      if (!result.ok) {
        await sub.unsubscribe().catch(() => false);
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
      operationInFlight.current = false;
      setLoading(false);
    }
  }, [client, options.projectId, options.swPath, reload]);

  const unsubscribe = React.useCallback(
    async (identifier?: string): Promise<{ ok: boolean }> => {
      if (!client?.isAuthenticated()) return { ok: false };
      if (operationInFlight.current) return { ok: false };
      operationInFlight.current = true;
      setLoading(true);
      setError(null);
      try {
        if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
          const reg = options.swPath
            ? await navigator.serviceWorker.getRegistration(options.swPath)
            : await navigator.serviceWorker.ready;
          const local = await reg?.pushManager.getSubscription();
          const idToRemove =
            identifier || (local ? JSON.stringify({ endpoint: local.endpoint }) : null);
          if (idToRemove) {
            await client.unregisterWebPush(idToRemove);
          }
          if (local && !identifier) {
            await local.unsubscribe();
          }
        } else if (identifier) {
          await client.unregisterWebPush(identifier);
        }
        if (!identifier) setSubscribed(false);
        await reload();
        return { ok: true };
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return { ok: false };
      } finally {
        operationInFlight.current = false;
        setLoading(false);
      }
    },
    [client, options.swPath, reload],
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

function arrayBuffersEqual(left: ArrayBuffer, right: ArrayBuffer): boolean {
  if (left.byteLength !== right.byteLength) return false;
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  return leftBytes.every((byte, index) => byte === rightBytes[index]);
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) out[i] = rawData.charCodeAt(i);
  return out;
}

