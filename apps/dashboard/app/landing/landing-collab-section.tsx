"use client";

import React from "react";
import { ArrowRight, Pen, Columns3, FileText, Boxes, BookOpen, FileSpreadsheet, Folder, Bot } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const COLLAB_FEATURES = [
  {
    id: "whiteboard",
    label: "Whiteboard",
    icon: Pen,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    desc: "Infinite canvas with Excalidraw. Real-time sync via CRDT.",
    preview: "whiteboard",
  },
  {
    id: "kanban",
    label: "Kanban",
    icon: Columns3,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    desc: "Drag-and-drop tasks across columns. Y.Array-powered sync.",
    preview: "kanban",
  },
  {
    id: "notes",
    label: "Notes",
    icon: FileText,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    desc: "Rich markdown with Y.Text. See collaborators type in real-time.",
    preview: "notes",
  },
];

const MORE_TOOLS = [
  { icon: Boxes, label: "Spatial View", color: "text-purple-400" },
  { icon: BookOpen, label: "Document", color: "text-rose-400" },
  { icon: FileSpreadsheet, label: "Spreadsheet", color: "text-cyan-400" },
  { icon: Folder, label: "Files", color: "text-orange-400" },
  { icon: Bot, label: "AI Summaries", color: "text-violet-400" },
];

function WhiteboardPreview() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.clientWidth * 2;
    canvas.height = canvas.clientHeight * 2;
    ctx.scale(2, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    let angle = 0;
    let trail: { x: number; y: number }[] = [];
    let anim: number;

    const render = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(15,23,42,0.6)";
      ctx.fillRect(0, 0, w, h);
      angle += 0.02;

      // Lissajous curve trail
      const cx = w / 2, cy = h / 2;
      const x = cx + Math.sin(angle * 0.7) * 60;
      const y = cy + Math.cos(angle * 1.3) * 50;
      trail.push({ x, y });
      if (trail.length > 40) trail = trail.slice(-40);

      trail.forEach((p, i) => {
        const alpha = i / trail.length;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2 * alpha + 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${alpha * 0.8})`;
        ctx.fill();
      });

      // Glow dot
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(99,102,241,0.9)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(99,102,241,0.15)";
      ctx.fill();

      anim = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(anim);
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full rounded-lg" />;
}

function KanbanPreview() {
  const [cards, setCards] = React.useState([
    { id: "a", text: "API design", col: 0 },
    { id: "b", text: "Auth flow", col: 0 },
    { id: "c", text: "UI kit", col: 1 },
    { id: "d", text: "Tests", col: 2 },
  ]);
  const cols = ["To Do", "In Progress", "Done"];

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCards((prev) =>
        prev.map((c) => {
          if (Math.random() > 0.7 && c.col < 2) return { ...c, col: c.col + 1 };
          return c;
        }),
      );
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex h-full gap-1.5 p-2">
      {cols.map((col, ci) => (
        <div key={col} className="flex flex-1 flex-col gap-1 rounded-md bg-white/5 p-1.5">
          <span className="text-[9px] font-medium text-slate-400">{col}</span>
          {cards.filter((c) => c.col === ci).map((c) => (
            <div
              key={c.id}
              className="animate-in fade-in-0 rounded border border-white/10 bg-white/10 px-1.5 py-1 text-[8px] text-slate-200"
            >
              {c.text}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function NotesPreview() {
  const [text, setText] = React.useState("");
  const full = "# Planning\n\n- Q3 roadmap\n- User research\n- Sprint goals\n\n> Real-time collaboration";
  React.useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i++;
      if (i > full.length) { i = 0; setText(""); return; }
      setText(full.slice(0, i));
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-full overflow-hidden p-3 font-mono text-[9px] leading-relaxed text-slate-200">
      {text || <span className="text-slate-500">Typing...</span>}
    </div>
  );
}

export function LandingCollabSection() {
  const [activeIdx, setActiveIdx] = React.useState(0);
  const sectionRef = React.useRef<HTMLElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  React.useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => {
      setActiveIdx((i) => (i + 1) % COLLAB_FEATURES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [visible]);

  const previews = [WhiteboardPreview, KanbanPreview, NotesPreview];

  return (
    <section
      ref={sectionRef}
      id="collaboration"
      className="scroll-mt-20 border-b border-white/10 bg-slate-950 px-4 py-20 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-400">FluxyCollab</p>
          <h2 className="text-balance font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything teams need to build together
          </h2>
          <p className="mx-auto max-w-2xl text-pretty leading-relaxed text-slate-300">
            Whiteboard, kanban, documents, spreadsheets, and AI, all synced in real-time via CRDT.
            No save button required.
          </p>
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {COLLAB_FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            const active = idx === activeIdx;
            const Preview = previews[idx];
            return (
              <button
                key={feat.id}
                onClick={() => setActiveIdx(idx)}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-all duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                  active
                    ? `${feat.border} bg-white/[0.06] ring-1 ring-white/10 shadow-lg shadow-${feat.id}-500/5`
                    : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/20",
                )}
              >
                {active && (
                  <span
                    className="absolute inset-x-0 top-0 h-0.5 animate-in fade-in-0 slide-in-from-left duration-500"
                    style={{ backgroundColor: feat.color === "text-indigo-400" ? "#6366f1" : feat.color === "text-emerald-400" ? "#22c55e" : "#f59e0b" }}
                  />
                )}
                <div className="flex items-center gap-2 p-4 pb-0">
                  <div className={cn("rounded-lg p-1.5", feat.bg)}>
                    <Icon className={cn("h-4 w-4", feat.color)} />
                  </div>
                  <span className="text-sm font-semibold text-white">{feat.label}</span>
                </div>
                <div className="flex-1 p-3">
                  {visible && <Preview />}
                </div>
                <div className="px-4 pb-4">
                  <p className={cn("text-xs leading-relaxed transition-opacity duration-300", active ? "text-slate-300" : "text-slate-600")}>
                    {feat.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {MORE_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <span
                key={tool.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400"
              >
                <Icon className={cn("h-3 w-3", tool.color)} />
                {tool.label}
              </span>
            );
          })}
          <Link
            href="/collab"
            className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-300 hover:bg-purple-500/20"
          >
            Explore all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
