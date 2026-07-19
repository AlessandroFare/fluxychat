"use client";

import React, { useRef, useState } from "react";
import { Volume2, VolumeX, Maximize, Minimize, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreamPlayerProps {
  streamUrl: string | null;
  isLive: boolean;
  title?: string;
  className?: string;
}

export function StreamPlayer({ streamUrl, isLive, title, className }: StreamPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  };

  const hasVideo = Boolean(streamUrl);

  return (
    <div
      ref={containerRef}
      className={cn("relative aspect-video bg-black", fullscreen && "bg-black", className)}
    >
      {!hasVideo ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
          {isLive ? (
            <Loader2 className="size-8 animate-spin" />
          ) : (
            <>
              <div className="size-16 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <span className="text-2xl">&#9654;</span>
              </div>
              <p className="text-sm">Stream offline</p>
            </>
          )}
        </div>
      ) : (
        <>
          <iframe
            ref={iframeRef}
            src={`${streamUrl}${muted ? "?muted=true" : ""}`}
            className="h-full w-full"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="size-6 animate-spin text-white/60" />
            </div>
          )}

          {/* Controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity hover:opacity-100">
            <button
              type="button"
              onClick={() => setMuted(!muted)}
              className="rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30 transition-colors"
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>

            {isLive && (
              <span className="inline-flex items-center gap-1 rounded bg-red-600/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                <span className="size-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
            )}

            {title && (
              <span className="truncate text-xs text-white/80">{title}</span>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="ml-auto rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30 transition-colors"
              title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
