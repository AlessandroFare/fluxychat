"use client";

import { useEffect, useRef, useState } from "react";
import type { CartographyCluster, CartographyPoint } from "@/lib/cartography-client";

interface RoomCartographyMapProps {
  clusters: CartographyCluster[];
  points: CartographyPoint[];
  selectedClusterId: number | null;
  onSelectCluster: (clusterId: number | null) => void;
}

export function RoomCartographyMap({
  clusters,
  points,
  selectedClusterId,
  onSelectCluster,
}: RoomCartographyMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverCluster, setHoverCluster] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgb(15 23 42)";
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) / 520;

    for (const cluster of clusters) {
      const active = selectedClusterId === cluster.id || hoverCluster === cluster.id;
      const x = cx + cluster.x * scale;
      const y = cy + cluster.y * scale;
      const r = cluster.radius * scale * (active ? 1.08 : 1);

      const gradient = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      gradient.addColorStop(0, active ? "rgba(56, 189, 248, 0.55)" : "rgba(99, 102, 241, 0.45)");
      gradient.addColorStop(1, active ? "rgba(56, 189, 248, 0.08)" : "rgba(99, 102, 241, 0.05)");
      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(248, 250, 252, 0.92)";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${cluster.messageCount}`, x, y + 4);
    }

    const visiblePoints =
      selectedClusterId == null
        ? points
        : points.filter((p) => p.clusterId === selectedClusterId);

    for (const point of visiblePoints) {
      const x = cx + point.x * scale;
      const y = cy + point.y * scale;
      ctx.beginPath();
      ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [clusters, points, selectedClusterId, hoverCluster]);

  function hitTest(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const scale = Math.min(rect.width, rect.height) / 520;
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    for (const cluster of clusters) {
      const dx = x - (cx + cluster.x * scale);
      const dy = y - (cy + cluster.y * scale);
      const r = cluster.radius * scale;
      if (dx * dx + dy * dy <= r * r) return cluster.id;
    }
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="h-[420px] w-full rounded-lg border border-border bg-slate-900"
      aria-label="Room cartography cluster map"
      onClick={(event) => {
        const clusterId = hitTest(event.clientX, event.clientY);
        onSelectCluster(clusterId === selectedClusterId ? null : clusterId);
      }}
      onMouseMove={(event) => {
        setHoverCluster(hitTest(event.clientX, event.clientY));
      }}
      onMouseLeave={() => setHoverCluster(null)}
    />
  );
}
