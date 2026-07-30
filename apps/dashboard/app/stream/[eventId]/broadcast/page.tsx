"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Copy, Check, Loader2, Radio, Square, Camera, Monitor } from "lucide-react";
import { ConsoleShell } from "@/app/components/console-shell";
import { useDashboardSession } from "@/app/components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";

const WORKER_URL = getPublicWorkerUrl();

interface LiveEvent {
  id: string; title: string; description: string | null; status: string;
  streamUrl: string | null; rtmpsUrl?: string; streamKey?: string;
  roomId: string;
}

export default function BroadcastPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamKeyCopied, setStreamKeyCopied] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!token || !eventId) return;
    const load = async () => {
      try {
        const res = await fetch(`${WORKER_URL}/api/live/events/${eventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("not_found");
        const data = await res.json();
        setEvent(data);
        setIsLive(data.status === "live");
      } catch { setError("Event not found"); }
      setLoading(false);
    };
    void load();
  }, [eventId, token]);

  const toggleLive = async () => {
    if (!token || !eventId) return;
    setBusy(true);
    try {
      const newStatus = isLive ? "ended" : "live";
      const res = await fetch(`${WORKER_URL}/api/live/events/${eventId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setIsLive(!isLive);
        if (newStatus === "ended") {
          if (cameraStream) {
            cameraStream.getTracks().forEach((t) => t.stop());
            setCameraStream(null);
            setCameraOn(false);
          }
        }
      }
    } catch { /* noop */ }
    setBusy(false);
  };

  const provisionStream = async () => {
    if (!token || !eventId) return;
    setProvisioning(true);
    try {
      const res = await fetch(`${WORKER_URL}/api/live/events/${eventId}/provision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEvent(data);
      }
    } catch { /* noop */ }
    setProvisioning(false);
  };

  const toggleCamera = async () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
      setCameraOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCameraStream(stream);
      setCameraOn(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { /* noop */ }
  };

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  const copyStreamKey = () => {
    if (!event?.streamKey) return;
    navigator.clipboard.writeText(event.streamKey).then(() => {
      setStreamKeyCopied(true);
      setTimeout(() => setStreamKeyCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <ConsoleShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </ConsoleShell>
    );
  }

  if (error || !event) {
    return (
      <ConsoleShell>
        <div className="flex flex-col items-center gap-3 py-24">
          <p className="text-sm text-muted-foreground">{error || "Stream not found"}</p>
          <button
            type="button"
            onClick={() => router.push("/stream")}
            className="text-xs text-brand underline underline-offset-2"
          >
            Back to streams
          </button>
        </div>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell>
      <div className="flex h-full flex-col p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-medium text-foreground">{event.title || "Broadcast"}</h1>
            <p className="text-xs text-muted-foreground">Broadcaster dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push(`/stream/${eventId}`)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              View as viewer
            </button>
            <button
              type="button"
              onClick={() => void toggleLive()}
              disabled={busy}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors",
                isLive
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-green-600 text-white hover:bg-green-700",
                busy && "cursor-not-allowed opacity-60",
              )}
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : isLive ? <Square className="size-3" /> : <Radio className="size-3" />}
              {isLive ? "End stream" : "Go live"}
            </button>
          </div>
        </div>

        <div className="grid flex-1 gap-4 lg:grid-cols-3">
          {/* Camera preview */}
          <div className="relative lg:col-span-2">
            <div className="aspect-video rounded-xl border border-border bg-black flex items-center justify-center overflow-hidden">
              {cameraOn && cameraStream ? (
                <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Camera className="size-8" />
                  <span className="text-xs">Camera off</span>
                </div>
              )}
            </div>
            {isLive && (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            )}
          </div>

          {/* Controls panel */}
          <div className="flex flex-col gap-3">
            {event.rtmpsUrl && event.streamKey && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-2 text-xs font-semibold text-foreground">RTMP ingest</h3>
                <div className="mb-2">
                  <label className="text-[10px] text-muted-foreground">Server URL</label>
                  <code className="block truncate rounded bg-muted px-2 py-1 text-[11px] font-mono text-foreground">
                    {event.rtmpsUrl}
                  </code>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Stream key</label>
                  <div className="flex items-center gap-1">
                    <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-[11px] font-mono text-foreground">
                      {event.streamKey}
                    </code>
                    <button
                      type="button"
                      onClick={copyStreamKey}
                      className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Copy stream key"
                    >
                      {streamKeyCopied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-xs font-semibold text-foreground">Controls</h3>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => void toggleCamera()}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    cameraOn ? "bg-green-600/20 text-green-700" : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  <Camera className="size-4" />
                  {cameraOn ? "Camera on" : "Camera off"}
                </button>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-medium text-muted-foreground/50"
                >
                  <Monitor className="size-4" />
                  Screen share (coming soon)
                </button>
              </div>
            </div>

            {!event.rtmpsUrl && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-2 text-xs font-semibold text-foreground">Stream ingest</h3>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  Provision a Cloudflare Stream live input to get RTMP ingest URL and stream key.
                </p>
                <button
                  type="button"
                  onClick={() => void provisionStream()}
                  disabled={provisioning}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {provisioning && <Loader2 className="size-3 animate-spin" />}
                  Provision stream
                </button>
              </div>
            )}

            {!event.rtmpsUrl && (
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">OBS setup</p>
                <ol className="mt-2 list-inside list-decimal space-y-1 leading-relaxed">
                  <li>Open OBS Studio</li>
                  <li>Go to Settings &rarr; Stream</li>
                  <li>Service: Custom</li>
                  <li>Server: RTMP URL from above</li>
                  <li>Stream Key: Key from above</li>
                  <li>Click Start Streaming</li>
                </ol>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-xs font-semibold text-foreground">Stream info</h3>
              <dl className="mt-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className={cn("font-medium", isLive ? "text-green-600" : "text-muted-foreground")}>
                    {isLive ? "Live" : "Offline"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Room</dt>
                  <dd className="font-mono text-foreground">{event.roomId?.slice(0, 12)}...</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}
