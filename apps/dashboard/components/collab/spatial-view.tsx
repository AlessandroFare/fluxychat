"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useYjs } from "./yjs-provider";
import { useDashboardSession } from "@/app/components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";

const WORKER_URL = getPublicWorkerUrl();

interface SpatialUser {
  id: string; label: string; x: number; y: number; z: number;
  color: string; isSelf: boolean;
}

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#a855f7"];

export default function SpatialView({ roomId }: { roomId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();
  const { connected } = useYjs();
  const [users, setUsers] = useState<SpatialUser[]>([
    { id: "self", label: "You", x: 0, y: 0, z: 0, color: COLORS[0], isSelf: true },
  ]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [editingPos, setEditingPos] = useState<string | null>(null);
  const [posInput, setPosInput] = useState({ x: 0, y: 0, z: 0 });
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number>(0);

  // Simple 3D canvas renderer without external deps
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let angle = 0;

    const render = () => {
      if (!ctx || !canvas) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Grid floor
      ctx.strokeStyle = "rgba(100, 100, 120, 0.15)";
      ctx.lineWidth = 1;
      const gridSize = 40;
      const centerX = w / 2;
      const centerY = h * 0.6;
      angle += 0.003;

      for (let i = -10; i <= 10; i++) {
        const x1 = centerX + (i * gridSize - 200) * Math.cos(angle * 0.3);
        const y1 = centerY + (i * gridSize - 200) * Math.sin(angle * 0.2) * 0.3 - 50;
        const x2 = centerX + (i * gridSize + 200) * Math.cos(angle * 0.3);
        const y2 = centerY + (i * gridSize + 200) * Math.sin(angle * 0.2) * 0.3 - 50;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      for (let i = -10; i <= 10; i++) {
        const x1 = centerX + (i * gridSize) * Math.cos(angle * 0.3) - 200 * Math.cos(angle * 0.3);
        const y1 = centerY + (i * gridSize) * Math.sin(angle * 0.2) * 0.3 - 50 + 200 * Math.sin(angle * 0.2) * 0.3;
        const x2 = centerX + (i * gridSize) * Math.cos(angle * 0.3) + 200 * Math.cos(angle * 0.3);
        const y2 = centerY + (i * gridSize) * Math.sin(angle * 0.2) * 0.3 - 50 - 200 * Math.sin(angle * 0.2) * 0.3;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - x1 + x1, y2 - y1 + y1); ctx.stroke();
      }

      // Render users
      users.forEach((u) => {
        const sx = centerX + (u.x * 20) * Math.cos(angle * 0.3) - (u.z * 20) * Math.sin(angle * 0.3);
        const sy = centerY - (u.y * 20) - 50 + (u.x * 20) * Math.sin(angle * 0.2) * 0.3 + (u.z * 20) * Math.cos(angle * 0.2) * 0.3;
        const scale = 1 + (u.z * 0.05);

        // Shadow
        ctx.beginPath();
        ctx.arc(sx, centerY - 48, 8 * scale, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.1)";
        ctx.fill();

        // Avatar circle
        ctx.beginPath();
        ctx.arc(sx, sy, 14 * scale, 0, Math.PI * 2);
        ctx.fillStyle = u.color + "30";
        ctx.fill();
        ctx.strokeStyle = u.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner dot
        ctx.beginPath();
        ctx.arc(sx, sy, 6 * scale, 0, Math.PI * 2);
        ctx.fillStyle = u.color;
        ctx.fill();

        // Label
        ctx.fillStyle = "#fff";
        ctx.font = `${11 * scale}px monospace`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.font = `${11 * scale}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(u.label, sx, sy - 22 * scale);

        // Coords
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = `${8 * scale}px monospace`;
        ctx.fillText(`(${u.x}, ${u.y}, ${u.z})`, sx, sy + 28 * scale);

        // Selection ring
        if (selectedUser === u.id) {
          ctx.beginPath();
          ctx.arc(sx, sy, 20 * scale, 0, Math.PI * 2);
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      animRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [users, selectedUser]);

  // Audio proximity
  const toggleAudio = async () => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
      setAudioEnabled(false);
      return;
    }
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createPanner();
      panner.panningModel = "HRTF";
      osc.connect(panner);
      panner.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = 0;
      osc.frequency.value = 440;
      osc.start();

      // Position panner based on closest user
      const iv = setInterval(() => {
        if (!audioCtxRef.current) { clearInterval(iv); return; }
        const others = users.filter((u) => !u.isSelf);
        if (others.length === 0) { gain.gain.value = 0; return; }
        const closest = others.reduce((a, b) =>
          Math.abs(a.x) + Math.abs(a.y) + Math.abs(a.z) < Math.abs(b.x) + Math.abs(b.y) + Math.abs(b.z) ? a : b,
        );
        const dist = Math.sqrt(closest.x ** 2 + closest.y ** 2 + closest.z ** 2);
        const vol = Math.max(0, Math.min(1, 1 - dist / 20));
        gain.gain.value = vol * 0.15;
        panner.positionX.value = closest.x;
        panner.positionY.value = closest.y;
        panner.positionZ.value = closest.z;
      }, 200);
      setAudioEnabled(true);
    } catch { /* Audio not supported */ }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h * 0.6;

    let closest: string | null = null;
    let closestDist = 30;
    users.forEach((u) => {
      const sx = centerX + u.x * 20;
      const sy = centerY - u.y * 20 - 50;
      const d = Math.sqrt((mx - sx) ** 2 + (my - sy) ** 2);
      if (d < closestDist) { closest = u.id; closestDist = d; }
    });
    setSelectedUser(closest);
    if (closest) {
      const u = users.find((u) => u.id === closest);
      if (u) setPosInput({ x: u.x, y: u.y, z: u.z });
    }
  };

  const updatePosition = (id: string, x: number, y: number, z: number) => {
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, x, y, z } : u));
  };

  return (
    <div className="flex h-full flex-col bg-gray-900 text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-2 text-xs">
          <div className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-green-400" : "bg-yellow-400")} />
          {connected ? "Spatial room live" : "Offline"}
          <span className="text-muted-foreground">| {users.length} avatar{users.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAudio}
            className={cn("rounded-md px-2 py-1 text-[10px]", audioEnabled ? "bg-green-500 text-white" : "bg-white/10 text-white/60 hover:bg-white/20")}
          >
            {audioEnabled ? "🔊 Spatial audio" : "🔇 Enable audio"}
          </button>
          <button
            onClick={() => setUsers((prev) => [...prev, {
              id: `bot-${Date.now()}`, label: `Bot ${prev.length}`,
              x: Math.floor(Math.random() * 16) - 8, y: Math.floor(Math.random() * 6), z: Math.floor(Math.random() * 16) - 8,
              color: COLORS[prev.length % COLORS.length], isSelf: false,
            }])}
            className="rounded-md bg-white/10 px-2 py-1 text-[10px] hover:bg-white/20"
          >
            + Bot
          </button>
        </div>
      </div>

      <div className="flex flex-1">
        <canvas
          ref={canvasRef}
          className="flex-1 cursor-pointer"
          onClick={handleCanvasClick}
        />

        <div className="w-64 border-l border-white/10 p-3">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Avatars</h3>
          <div className="space-y-1">
            {users.map((u) => (
              <div
                key={u.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs cursor-pointer",
                  selectedUser === u.id ? "bg-white/10" : "hover:bg-white/5",
                )}
                onClick={() => { setSelectedUser(u.id); setPosInput({ x: u.x, y: u.y, z: u.z }); }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: u.color }} />
                <span className="flex-1">{u.label}</span>
                <span className="text-muted-foreground">({u.x},{u.y},{u.z})</span>
              </div>
            ))}
          </div>

          {selectedUser && (
            <div className="mt-3 border-t border-white/10 pt-3">
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Position</h4>
              <div className="grid grid-cols-3 gap-1">
                {(["x", "y", "z"] as const).map((axis) => (
                  <div key={axis}>
                    <label className="text-[9px] text-muted-foreground">{axis.toUpperCase()}</label>
                    <input
                      type="number"
                      className="w-full rounded border border-white/10 bg-transparent px-2 py-1 font-mono text-xs outline-none focus:border-primary"
                      value={posInput[axis]}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setPosInput((prev) => ({ ...prev, [axis]: val }));
                        updatePosition(selectedUser, axis === "x" ? val : posInput.x, axis === "y" ? val : posInput.y, axis === "z" ? val : posInput.z);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
