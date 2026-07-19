"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pen, Eraser, Move3d, Rotate3d, Square, Circle, Type, Trash2, Undo2 } from "lucide-react";
import { useYjs } from "./yjs-provider";
import { cn } from "@/lib/utils";

interface SpatialStroke {
  id: string; points: { x: number; y: number; z: number }[];
  color: string; size: number; tool: string;
}

const COLORS = ["#ffffff", "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4"];

export default function SpatialWhiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { doc, connected } = useYjs();
  const [strokes, setStrokes] = useState<SpatialStroke[]>([]);
  const [currentColor, setCurrentColor] = useState(COLORS[1]);
  const [currentSize, setCurrentSize] = useState(3);
  const [tool, setTool] = useState<"draw" | "erase" | "move">("draw");
  const [drawing, setDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<SpatialStroke | null>(null);
  const [angle, setAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);

  // Render 3D scene
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

    let animId = 0;
    const render = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      if (autoRotate) setAngle((a) => a + 0.005);

      // 3D grid
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 1;
      for (let i = -15; i <= 15; i++) {
        const x1 = cx + (i * 25 * Math.cos(angle));
        const y1 = cy + (i * 25 * Math.sin(angle * 0.5) * 0.3);
        ctx.beginPath();
        ctx.moveTo(x1 - 200, y1 + 200 * Math.sin(angle * 0.3) * 0.3);
        ctx.lineTo(x1 + 200, y1 - 200 * Math.sin(angle * 0.3) * 0.3);
        ctx.stroke();
      }
      for (let i = -15; i <= 15; i++) {
        const x1 = cx + (i * 25 * Math.cos(angle));
        const y1 = cy + (i * 25 * Math.sin(angle * 0.5) * 0.3);
        ctx.beginPath();
        ctx.moveTo(x1 - 200 * Math.cos(angle), y1 - 200 * Math.sin(angle * 0.5) * 0.3);
        ctx.lineTo(x1 + 200 * Math.cos(angle), y1 + 200 * Math.sin(angle * 0.5) * 0.3);
        ctx.stroke();
      }

      // Render strokes in 3D
      const allStrokes = [...strokes, ...(currentStroke ? [currentStroke] : [])];
      allStrokes.forEach((stroke) => {
        if (stroke.points.length < 2) return;
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        stroke.points.forEach((p, i) => {
          const sx = cx + p.x * Math.cos(angle) - p.z * Math.sin(angle);
          const sy = cy - p.y + (p.x * Math.sin(angle) + p.z * Math.cos(angle)) * 0.3;
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
      });

      // HUD
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "10px monospace";
      ctx.fillText(`${allStrokes.length} strokes | ${autoRotate ? "Auto-rotate" : `${(angle * 180 / Math.PI).toFixed(0)}°`}`, 10, 20);

      animId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [strokes, currentStroke, angle, autoRotate]);

  const get3DPoint = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left - canvas.width / 2;
    const my = e.clientY - rect.top - canvas.height / 2;
    return {
      x: (mx * Math.cos(-angle) - my * Math.sin(-angle) * 0.3) / 30,
      y: -my / 30,
      z: (mx * Math.sin(-angle) + my * Math.cos(-angle) * 0.3) / 30,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const p = get3DPoint(e);
    if (!p) return;
    setDrawing(true);
    const stroke: SpatialStroke = { id: Date.now().toString(), points: [p], color: currentColor, size: currentSize, tool };
    setCurrentStroke(stroke);
    setAutoRotate(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing || !currentStroke) return;
    const p = get3DPoint(e);
    if (!p) return;
    setCurrentStroke((prev) => prev ? { ...prev, points: [...prev.points, p] } : prev);
  };

  const handleMouseUp = () => {
    if (!drawing || !currentStroke) return;
    if (currentStroke.points.length > 1) {
      setStrokes((prev) => [...prev, currentStroke]);
    }
    setDrawing(false);
    setCurrentStroke(null);
  };

  const clearAll = () => setStrokes([]);

  const handleUndo = () => setStrokes((prev) => prev.slice(0, -1));

  return (
    <div className="flex h-full flex-col bg-gray-950 text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <div className="flex items-center gap-1.5 text-xs">
          <Move3d className="h-3.5 w-3.5 text-indigo-400" />
          Spatial Whiteboard
          <span className={cn("ml-2 h-1.5 w-1.5 rounded-full", connected ? "bg-green-400" : "bg-yellow-400")} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoRotate(!autoRotate)} className={cn("rounded-md px-2 py-1 text-[10px]", autoRotate ? "bg-indigo-500" : "bg-white/10 hover:bg-white/20")}>
            <Rotate3d className="mr-1 inline h-3 w-3" />{autoRotate ? "Auto" : "Manual"}
          </button>
          <button onClick={handleUndo} className="rounded-md bg-white/10 px-2 py-1 text-[10px] hover:bg-white/20" disabled={strokes.length === 0}><Undo2 className="h-3 w-3" /></button>
          <button onClick={clearAll} className="rounded-md bg-white/10 px-2 py-1 text-[10px] hover:bg-white/20" disabled={strokes.length === 0}><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="flex-1 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { if (drawing) handleMouseUp(); }}
      />

      <div className="flex items-center justify-between border-t border-white/10 px-4 py-2">
        <div className="flex items-center gap-1">
          {(["draw", "erase", "move"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={cn("rounded-md p-1.5", tool === t ? "bg-indigo-500" : "hover:bg-white/10")}
            >
              {t === "draw" ? <Pen className="h-3.5 w-3.5" /> : t === "erase" ? <Eraser className="h-3.5 w-3.5" /> : <Move3d className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setCurrentColor(c)}
              className={cn("h-4 w-4 rounded-full", currentColor === c && "ring-2 ring-white ring-offset-1 ring-offset-gray-950")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          {[2, 4, 6, 8].map((s) => (
            <button
              key={s}
              onClick={() => setCurrentSize(s)}
              className={cn("rounded-full", currentSize === s && "ring-2 ring-white")}
            >
              <div className="rounded-full bg-white" style={{ width: s + 2, height: s + 2 }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
