"use client";

import React from "react";
import { Loader2, Bell, BellOff, MonitorSmartphone, CheckCircle2 } from "lucide-react";
import { useWebPush } from "@fluxy-chat/sdk";
import {
  FeatureCodePanel,
  FeaturePreviewFrame,
  ShowcaseUnavailable,
  Kw,
  Ident,
  Str,
} from "./feature-code-panel";
import type { ShowcaseSession } from "./use-showcase-session";

const SW_PATH = "/fluxy-push-sw.js";

/**
 * Push Notifications showcase — real VAPID Web Push through the SDK.
 * `requestPermissionAndSubscribe()` registers this browser with the Worker;
 * when a user is offline, the Worker delivers messages as pushes and falls
 * back to bridged channels (Slack / Discord / email digest).
 */
export function PushNotificationsShowcase({ session }: { session: ShowcaseSession }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
      <FeatureCodePanel
        title="Push notifications, even when they're offline."
        description="A message sent through FluxyChat isn't trapped in your app. When a user isn't connected to the room, the Worker delivers it as a VAPID web push to their device — and falls back to bridged channels like Slack, Discord, and email digests."
      >
        <Kw>const</Kw>
        {" { requestPermissionAndSubscribe } = "}
        <Ident>useWebPush</Ident>
        {"(client, {\n  swPath: "}
        <Str>{'"/fluxy-push-sw.js"'}</Str>
        {",\n});\n\n"}
        <Kw>await</Kw>{" "}
        <Ident>requestPermissionAndSubscribe</Ident>
        {"();\n"}
        {"// offline users get a push; Slack / email fall back."}
      </FeatureCodePanel>

      <FeaturePreviewFrame label="Push notifications preview" className="min-h-[28rem]">
        {session.status === "loading" ? (
          <div className="flex h-full min-h-64 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            <span className="sr-only">Connecting to the live demo session</span>
          </div>
        ) : session.status === "unavailable" || !session.client ? (
          <ShowcaseUnavailable error={session.error} onRetry={session.retry} />
        ) : (
          <PushPanel session={session} />
        )}
      </FeaturePreviewFrame>
    </div>
  );
}

function PushPanel({ session }: { session: ShowcaseSession }) {
  const [swReady, setSwReady] = React.useState(false);

  // Register the showcase service worker so PushManager.subscribe works.
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register(SW_PATH)
      .then(() => setSwReady(true))
      .catch(() => setSwReady(false));
  }, []);

  const {
    supported,
    permission,
    subscribed,
    subscriptions,
    loading,
    error,
    requestPermissionAndSubscribe,
    unsubscribe,
  } = useWebPush(session.client, { swPath: SW_PATH });

  const canSubscribe = supported && swReady && permission !== "denied" && !subscribed;

  return (
    <div className="flex h-full flex-col">
      {/* Phone-style status header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
          <MonitorSmartphone className="size-4 text-muted-foreground" aria-hidden />
          This browser
        </span>
        <span
          className={
            subscribed
              ? "inline-flex items-center gap-1.5 rounded-full bg-[var(--fluxy-cta-color)]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[var(--fluxy-cta-color)]"
              : "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
          }
        >
          {subscribed ? (
            <>
              <CheckCircle2 className="size-3" aria-hidden /> Subscribed
            </>
          ) : (
            <>Permission: {permission}</>
          )}
        </span>
      </div>

      {/* Registered devices, rendered as notification cards */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {!supported ? (
          <p className="text-xs text-muted-foreground">
            Web Push is not supported in this browser.
          </p>
        ) : subscriptions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Bell className="size-6 text-muted-foreground" aria-hidden />
            <p className="max-w-56 text-xs leading-relaxed text-muted-foreground">
              No devices registered yet. Enable push below to register this
              browser with the Worker.
            </p>
          </div>
        ) : (
          subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Bell className="size-4 text-[var(--fluxy-cta-color)]" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">
                  {sub.endpointHost}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {sub.userAgent ?? "Unknown device"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {sub.lastSentAt
                    ? `Last push ${new Date(sub.lastSentAt).toLocaleString()}`
                    : "No pushes delivered yet"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void unsubscribe(sub.id)}
                className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Remove
              </button>
            </div>
          ))
        )}
        {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        {subscribed ? (
          <button
            type="button"
            onClick={() => void unsubscribe()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <BellOff className="size-3.5" aria-hidden />
            Disable push
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void requestPermissionAndSubscribe()}
            disabled={!canSubscribe || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Bell className="size-3.5" aria-hidden />
            )}
            Enable push on this device
          </button>
        )}
        {permission === "denied" ? (
          <span className="text-[11px] text-muted-foreground">
            Notifications are blocked in browser settings.
          </span>
        ) : null}
      </div>
    </div>
  );
}
