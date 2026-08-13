"use client";

import React, { useEffect, useState } from "react";
import { ConsoleShell } from "@/app/components/console-shell";
import { ConsolePageHeader } from "@/app/components/console-page-header";
import { ConsoleProjectRoomBar } from "@/app/components/console-project-room-bar";
import { cn } from "@/lib/utils";
import { createWebTransportAdapter, createAdaptiveTransport, type WebTransportNegotiation, type TransportHealth } from "@fluxy-chat/sdk";
import { Zap, CheckCircle2, XCircle, AlertTriangle, Activity, ArrowRight, Wifi, Globe } from "lucide-react";

export default function WebTransportPage() {
  const [negotiation, setNegotiation] = useState<WebTransportNegotiation | null>(null);
  const [health, setHealth] = useState<TransportHealth | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [current, setCurrent] = useState<string>("");
  const [fallbackLog, setFallbackLog] = useState<{ from: string; to: string; timestamp: string }[]>([]);

  useEffect(() => {
    const wt = createWebTransportAdapter();
    const adaptive = createAdaptiveTransport({ initialTransport: "webtransport" });

    setNegotiation(wt.negotiate());
    setHealth(adaptive.getHealth());
    setAvailable(adaptive.getAvailableTransports());
    setCurrent(adaptive.getCurrentTransport());

    adaptive.onFallback((from, to) => {
      setFallbackLog((prev) => [...prev, { from, to, timestamp: new Date().toISOString() }]);
      setCurrent(to);
      setHealth(adaptive.getHealth());
    });

    // Simulate health updates
    const interval = setInterval(() => {
      setHealth(adaptive.getHealth());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const transportDetails = [
    {
      name: "WebTransport",
      icon: <Zap className="size-4" />,
      status: negotiation?.supported ? "available" : "unavailable",
      description: "HTTP/3 based, datagrams + bidirectional streams. Lowest latency, unreliable+reliable modes.",
      benefits: ["Datagrams for presence/typing/position", "Bidirectional for chat/commands", "0-RTT connection migration"],
      note: "Cloudflare Workers does NOT support WebTransport yet (issue #6451). Browser support: Safari 26.4+, Chrome. Auto-fallback to WebSocket.",
    },
    {
      name: "WebSocket",
      icon: <Wifi className="size-4" />,
      status: "available",
      description: "Reliable bidirectional over TCP. Current production transport.",
      benefits: ["Universal browser support", "Durable Object integration", "Binary + text frames"],
      note: "Default transport. Used when WebTransport is unavailable or falls back.",
    },
    {
      name: "SSE (Server-Sent Events)",
      icon: <Globe className="size-4" />,
      status: "fallback",
      description: "Unidirectional server→client. Used when WebSocket fails.",
      benefits: ["HTTP/1.1 compatible", "Proxy-friendly", "Auto-reconnect"],
      note: "Fallback only. Cannot send client→server messages (requires separate POST).",
    },
    {
      name: "Long Polling",
      icon: <Activity className="size-4" />,
      status: "fallback",
      description: "HTTP polling with long-held requests. Last resort fallback.",
      benefits: ["Works through any proxy/firewall", "No special protocol support needed"],
      note: "Highest latency. Only used when all other transports fail.",
    },
  ];

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="WebTransport Readiness"
        description="Auto-negotiation: WebTransport → WebSocket → SSE → Long Poll. Client-side feature detection with automatic fallback."
      />

      <ConsoleProjectRoomBar
        hint="Transport negotiation runs client-side. Production chat uses WebSocket on your Worker today; WebTransport auto-fallback is ready when CF supports it."
      />

      <div className="flex flex-1 flex-col gap-4 p-4 pt-2">
        {/* Status banner */}
        <div className={cn(
          "flex items-center gap-3 rounded-xl border p-4",
          negotiation?.supported
            ? "border-green-500/30 bg-green-500/5"
            : "border-amber-500/30 bg-amber-500/5",
        )}>
          {negotiation?.supported ? (
            <CheckCircle2 className="size-5 text-green-500" />
          ) : (
            <AlertTriangle className="size-5 text-amber-500" />
          )}
          <div>
            <p className="text-sm font-medium">
              {negotiation?.supported
                ? "WebTransport is available in this browser"
                : "WebTransport NOT available. Using WebSocket fallback"}
            </p>
            <p className="text-xs text-muted-foreground">
              {negotiation?.supported
                ? `Capabilities: ${negotiation.capabilities.join(", ")}. Fallback: ${negotiation.fallback}`
                : `Fallback transport: ${negotiation?.fallback || "websocket"}. Cloudflare Workers does not support WebTransport yet (issue #6451).`}
            </p>
          </div>
        </div>

        {/* Current transport */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Active Transport</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm font-bold capitalize">{current}</span>
              <span className="size-2 rounded-full bg-green-500 animate-pulse" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Available</div>
            <div className="mt-1 text-sm font-bold">{available.length} transports</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Failures</div>
            <div className="mt-1 text-sm font-bold tabular-nums">{health?.consecutiveFailures ?? 0}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Threshold</div>
            <div className="mt-1 text-sm font-bold">3 failures</div>
          </div>
        </div>

        {/* Transport chain */}
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Fallback chain
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {available.map((t, i) => (
              <React.Fragment key={t}>
                <div className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2",
                  t === current ? "border-foreground bg-foreground/5" : "border-border bg-card",
                )}>
                  <span className={cn(
                    "size-2 rounded-full",
                    t === current ? "bg-green-500" : i < available.indexOf(current) ? "bg-red-500/50" : "bg-muted-foreground/30",
                  )} />
                  <span className="text-sm font-medium capitalize">{t}</span>
                </div>
                {i < available.length - 1 && <ArrowRight className="size-3 text-muted-foreground" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Transport details */}
        <div className="grid gap-3 lg:grid-cols-2">
          {transportDetails.map((t) => (
            <div key={t.name} className={cn(
              "rounded-xl border p-4",
              t.status === "available" && "border-border bg-card",
              t.status === "unavailable" && "border-amber-500/20 bg-amber-500/5",
              t.status === "fallback" && "border-border bg-muted/30",
            )}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    t.status === "available" ? "bg-green-500/10 text-green-600" : "",
                    t.status === "unavailable" ? "bg-amber-500/10 text-amber-600" : "",
                    t.status === "fallback" ? "bg-muted text-muted-foreground" : "",
                  )}>
                    {t.icon}
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold">{t.name}</h4>
                    <span className={cn(
                      "text-[10px] font-semibold uppercase",
                      t.status === "available" && "text-green-600",
                      t.status === "unavailable" && "text-amber-600",
                      t.status === "fallback" && "text-muted-foreground",
                    )}>
                      {t.status === "available" && "✓ Ready"}
                      {t.status === "unavailable" && "⚠ Not supported"}
                      {t.status === "fallback" && "↩ Fallback"}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t.description}</p>
              <ul className="mt-2 space-y-0.5">
                {t.benefits.map((b) => (
                  <li key={b} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <CheckCircle2 className="size-3 text-green-500/60" /> {b}
                  </li>
                ))}
              </ul>
              <p className="mt-2 rounded bg-muted/50 px-2 py-1 text-[10px] italic text-muted-foreground">{t.note}</p>
            </div>
          ))}
        </div>

        {/* Fallback log */}
        {fallbackLog.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fallback events
            </h3>
            <div className="space-y-1">
              {fallbackLog.map((e, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs">
                  <XCircle className="size-3 text-red-500" />
                  <span className="font-medium">{e.from}</span>
                  <ArrowRight className="size-3 text-muted-foreground" />
                  <span className="font-medium">{e.to}</span>
                  <span className="ml-auto text-muted-foreground">{new Date(e.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info panel */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
            Implementation status
          </h3>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <p>✅ <span className="font-medium text-foreground">SDK ready</span>: <code className="rounded bg-muted px-1">createWebTransportAdapter()</code> with feature detection + <code className="rounded bg-muted px-1">createAdaptiveTransport()</code> with auto-fallback chain</p>
            <p>✅ <span className="font-medium text-foreground">Client negotiation</span>: tries WebTransport first, falls back to WebSocket automatically</p>
            <p>⚠️ <span className="font-medium text-foreground">Cloudflare Workers</span>: does NOT support WebTransport (issue <a href="https://github.com/cloudflare/workerd/issues/6451" className="text-blue-500 underline underline-offset-2" target="_blank" rel="noopener noreferrer">cloudflare/workerd#6451</a>). WebSocket is production transport.</p>
            <p>📊 <span className="font-medium text-foreground">Browser support</span>: Safari 26.4+, Chrome 97+. Firefox behind flag.</p>
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}
