"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface MentionSuggestion {
  id: string;
  label: string;
  description: string;
  kind: "special" | "role" | "user";
  role?: string;
}

interface MentionMenuProps {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  suggestions: MentionSuggestion[];
  onSelect: (item: MentionSuggestion) => void;
  onClose: () => void;
}

export function MentionMenu({ inputRef, suggestions, onSelect, onClose }: MentionMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handler = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (ke.key === "ArrowDown") {
        ke.preventDefault();
        setSelectedIndex((p) => Math.min(p + 1, Math.max(suggestions.length - 1, 0)));
      }
      if (ke.key === "ArrowUp") {
        ke.preventDefault();
        setSelectedIndex((p) => Math.max(p - 1, 0));
      }
      if (ke.key === "Enter" && suggestions[selectedIndex]) {
        ke.preventDefault();
        onSelect(suggestions[selectedIndex]);
        onClose();
      }
      if (ke.key === "Escape") onClose();
    };
    input.addEventListener("keydown", handler);
    return () => input.removeEventListener("keydown", handler);
  }, [suggestions, selectedIndex, onSelect, onClose, inputRef]);

  if (!suggestions.length) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 z-50 mb-1 max-h-56 w-80 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-xl"
      role="listbox"
      aria-label="Mention suggestions"
    >
      {suggestions.map((item, i) => (
        <button
          key={`${item.kind}:${item.id}`}
          type="button"
          role="option"
          aria-selected={i === selectedIndex}
          className={cn(
            "flex w-full flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left text-xs",
            i === selectedIndex
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
            onClose();
          }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span className="font-mono font-semibold">{item.label}</span>
          <span className="text-muted-foreground/70">{item.description}</span>
        </button>
      ))}
    </div>
  );
}

/** Replace the active @query token at the cursor with a chosen mention label. */
export function insertMentionAtCursor(
  input: HTMLTextAreaElement,
  mentionLabel: string,
  setValue: (next: string) => void,
) {
  const cursor = input.selectionStart ?? input.value.length;
  const before = input.value.slice(0, cursor);
  const after = input.value.slice(cursor);
  const atIdx = before.lastIndexOf("@");
  if (atIdx === -1) return;
  const prefix = before.slice(0, atIdx);
  const insert = mentionLabel.startsWith("@") ? mentionLabel : `@${mentionLabel}`;
  const next = `${prefix}${insert} ${after}`;
  setValue(next);
  const pos = `${prefix}${insert} `.length;
  requestAnimationFrame(() => {
    input.focus();
    input.setSelectionRange(pos, pos);
  });
}

export function detectMentionQuery(value: string, cursor: number): string | null {
  const before = value.slice(0, cursor);
  const atIdx = before.lastIndexOf("@");
  if (atIdx === -1) return null;
  const fragment = before.slice(atIdx + 1);
  if (fragment.includes(" ") || fragment.includes("\n")) return null;
  return fragment;
}
