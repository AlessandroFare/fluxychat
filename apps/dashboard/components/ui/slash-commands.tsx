"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

const FALLBACK_COMMANDS = [
  { command: "/help", description: "Show available commands" },
  { command: "/poll", description: "Create a quick poll", usage: '/poll Question? | A | B' },
  { command: "/remind", description: "Schedule a reminder", usage: "/remind 30m text" },
  { command: "/assign", description: "Assign a task", usage: "/assign @user task" },
  { command: "/summarize", description: "AI summary of recent messages" },
  { command: "/escalate", description: "Escalate to human agent" },
  { command: "/members", description: "List room members" },
  { command: "/info", description: "Show room information" },
  { command: "/clear", description: "Clear your draft message" },
];

interface SlashCommandMenuProps {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  commands?: Array<{ command: string; description: string; usage?: string; required_role?: string }>;
  onCommand: (command: string, args: string) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ inputRef, commands, onCommand, onClose }: SlashCommandMenuProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const available = commands?.length ? commands : FALLBACK_COMMANDS;

  const filtered = available.filter(
    (c) =>
      c.command.startsWith("/" + query) ||
      c.command.startsWith(query) ||
      c.description.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handler = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === "ArrowDown") { ke.preventDefault(); setSelectedIndex((p) => Math.min(p + 1, filtered.length - 1)); }
      if (ke.key === "ArrowUp") { ke.preventDefault(); setSelectedIndex((p) => Math.max(p - 1, 0)); }
      if (ke.key === "Enter" && filtered[selectedIndex]) {
        ke.preventDefault();
        onCommand(filtered[selectedIndex].command, "");
        onClose();
      }
      if (ke.key === "Escape") { onClose(); }
    };
    input.addEventListener("keydown", handler);
    return () => input.removeEventListener("keydown", handler);
  }, [filtered, selectedIndex, onCommand, onClose, inputRef]);

  useEffect(() => {
    const handler = () => {
      const input = inputRef.current;
      if (!input) return;
      const val = input.value;
      const cursor = input.selectionStart ?? 0;
      const before = val.slice(0, cursor);
      const slashIdx = before.lastIndexOf("/");
      if (slashIdx === -1 || before.slice(slashIdx).includes(" ")) { onClose(); return; }
      setQuery(before.slice(slashIdx + 1));
      setSelectedIndex(0);
    };
    const input = inputRef.current;
    if (!input) return;
    input.addEventListener("input", handler);
    return () => input.removeEventListener("input", handler);
  }, [inputRef, onClose]);

  if (!filtered.length) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 z-50 mb-1 max-h-56 w-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 text-slate-900 shadow-2xl"
    >
      {filtered.map((cmd, i) => (
        <button
          key={cmd.command}
          type="button"
          className={cn(
            "flex w-full flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left text-xs",
            i === selectedIndex ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
          )}
          onMouseDown={(e) => { e.preventDefault(); onCommand(cmd.command, ""); onClose(); }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span className="font-mono font-semibold">{cmd.command}</span>
          <span className="text-slate-500">{cmd.description}</span>
        </button>
      ))}
    </div>
  );
}

export function useSlashCommand() {
  const [showSlash, setShowSlash] = useState(false);

  const handleInput = useCallback((value: string) => {
    const lastSlash = value.lastIndexOf("/");
    if (lastSlash !== -1 && !value.slice(lastSlash).includes(" ")) {
      setShowSlash(true);
    } else {
      setShowSlash(false);
    }
  }, []);

  return { showSlash, setShowSlash, handleInput };
}

export { FALLBACK_COMMANDS };
