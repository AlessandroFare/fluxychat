"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SyncedAngleReplay {
  angleId: string;
  label: string;
  sortOrder: number;
  playbackHls: string;
  offsetMs: number;
  thumbnailUrl?: string;
}

interface SyncedReplayPlayerProps {
  angles: SyncedAngleReplay[];
  poster?: string;
}

export function SyncedReplayPlayer({ angles, poster }: SyncedReplayPlayerProps) {
  const sorted = [...angles].sort((a, b) => a.sortOrder - b.sortOrder);
  const [activeId, setActiveId] = useState(sorted[0]?.angleId ?? "");
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingSeekRef = useRef<number | null>(null);

  const active = sorted.find((a) => a.angleId === activeId) ?? sorted[0];

  useEffect(() => {
    if (pendingSeekRef.current == null || !videoRef.current) return;
    const target = pendingSeekRef.current;
    pendingSeekRef.current = null;
    videoRef.current.currentTime = target;
  }, [activeId, active?.playbackHls]);

  function switchAngle(nextId: string) {
    if (nextId === activeId) return;
    const prev = sorted.find((a) => a.angleId === activeId);
    const next = sorted.find((a) => a.angleId === nextId);
    const video = videoRef.current;
    if (!prev || !next || !video) {
      setActiveId(nextId);
      return;
    }
    const adjusted = video.currentTime + (prev.offsetMs - next.offsetMs) / 1000;
    pendingSeekRef.current = Math.max(0, adjusted);
    setActiveId(nextId);
  }

  if (!active?.playbackHls) return null;

  return (
    <div className="relative aspect-video bg-black">
      {sorted.length > 1 ? (
        <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1.5">
          {sorted.map((angle) => (
            <button
              key={angle.angleId}
              type="button"
              onClick={() => switchAngle(angle.angleId)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium backdrop-blur-sm",
                activeId === angle.angleId
                  ? "bg-white/90 text-black"
                  : "bg-black/50 text-white hover:bg-black/70",
              )}
            >
              {angle.label}
            </button>
          ))}
        </div>
      ) : null}
      <video
        ref={videoRef}
        className="h-full w-full"
        controls
        playsInline
        src={active.playbackHls}
        poster={active.thumbnailUrl ?? poster}
      />
    </div>
  );
}
