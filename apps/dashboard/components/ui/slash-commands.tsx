"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

const BUILTIN_COMMANDS = [
  { command: "/help", description: "Show available commands" },
  { command: "/mute", description: "Mute a user in this room", role: "mod" },
  { command: "/unmute", description: "Unmute a user", role: "mod" },
  { command: "/pin", description: "Pin the last message or a specific message", role: "mod" },
  { command: "/unpin", description: "Unpin a pinned message", role: "mod" },
  { command: "/escalate", description: "Escalate conversation to a human agent" },
  { command: "/summarize", description: "Get an AI summary of recent messages" },
  { command: "/broadcast", description: "Send broadcast to all room members", role: "admin" },
  { command: "/export", description: "Export room history", role: "admin" },
  { command: "/members", description: "List room members" },
  { command: "/info", description: "Show room information" },
  { command: "/clear", description: "Clear your draft message" },
];

interface SlashCommandMenuProps {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onCommand: (command: string, args: string) => void;
  onClose: () => void;
}

export function SlashCommandMenu({ inputRef, onCommand, onClose }: SlashCommandMenuProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = BUILTIN_COMMANDS.filter(
    (c) => c.command.startsWith("/" + query) && !c.role,
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
    const handler = (e: Event) => {
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
      className="absolute bottom-full left-0 z-50 mb-1 w-64 rounded-lg border border-border bg-popover p-1 shadow-xl"
    >
      {filtered.map((cmd, i) => (
        <button
          key={cmd.command}
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs",
            i === selectedIndex ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          onMouseDown={(e) => { e.preventDefault(); onCommand(cmd.command, ""); onClose(); }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span className="font-mono font-semibold">{cmd.command}</span>
          <span className="text-muted-foreground/70">{cmd.description}</span>
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
