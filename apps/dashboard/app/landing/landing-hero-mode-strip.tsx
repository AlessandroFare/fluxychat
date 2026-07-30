"use client";

import { useEffect, useState } from "react";
import {
  CalendarRange,
  Gamepad2,
  GraduationCap,
  MessageSquare,
  Radio,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RoomMode {
  id: string;
  label: string;
  caption: string;
  icon: LucideIcon;
}

const ROOM_MODES: RoomMode[] = [
  { id: "chat", label: "Chat room", caption: "Messages, agents, presence", icon: MessageSquare },
  { id: "classroom", label: "Classroom", caption: "Polls, attendance, breakouts", icon: GraduationCap },
  { id: "event", label: "Live event", caption: "Stage, Q&A, tickets", icon: CalendarRange },
  { id: "game", label: "Game session", caption: "Authoritative state sync", icon: Gamepad2 },
  { id: "devices", label: "Device room", caption: "Shadow, rules, telemetry", icon: Radio },
];

const ROTATE_MS = 4200;

export function LandingHeroModeStrip() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    function sync() {
      setReduceMotion(media.matches);
    }
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % ROOM_MODES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const active = ROOM_MODES[activeIndex] ?? ROOM_MODES[0];
  const ActiveIcon = active.icon;

  return (
    <div
      className="mt-8 w-full max-w-3xl rounded-2xl border border-black/[0.08] bg-white/85 p-4 shadow-[var(--shadow-subtle-2)] backdrop-blur-md"
      aria-live={reduceMotion ? "off" : "polite"}
    >
      <p className="text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        One room · many modes
      </p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 text-left">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#111111] text-white">
            <ActiveIcon className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-heading text-lg font-semibold text-[#111111]">{active.label}</p>
            <p className="text-sm text-slate-600">{active.caption}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 sm:justify-end" role="tablist" aria-label="Room modes">
          {ROOM_MODES.map((mode, index) => {
            const Icon = mode.icon;
            const isActive = index === activeIndex;
            return (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={mode.label}
                title={mode.label}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-lg border transition",
                  isActive
                    ? "border-[#111111] bg-[#111111] text-white"
                    : "border-black/[0.08] bg-white text-slate-600 hover:border-black/15 hover:text-slate-900",
                )}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
