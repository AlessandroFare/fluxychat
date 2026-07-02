"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { BrainCircuit, FileImage, ImagePlus, Search } from "lucide-react";
import { cn } from "./lib/utils";

export interface ComposerToolsMenuProps {
  disabled?: boolean;
  className?: string;
  onAddFiles?: () => void;
  onCreateImage?: () => void;
  onDeepResearch?: () => void;
  onWebSearch?: () => void;
  /** Accessible label for the trigger button. */
  triggerLabel?: string;
}

/**
 * “+” composer menu — attach files, generate images, deep research, web search.
 * Wire callbacks from the host (dashboard agent chat, SDK ChatWindow, etc.).
 */
export function ComposerToolsMenu({
  disabled = false,
  className,
  onAddFiles,
  onCreateImage,
  onDeepResearch,
  onWebSearch,
  triggerLabel = "Attach files or use tools",
}: ComposerToolsMenuProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ left: 0, bottom: 0 });

  const updatePosition = React.useCallback(() => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    setPosition({
      left: rect.left,
      bottom: window.innerHeight - rect.top,
    });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updatePosition();
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    function onResize() {
      updatePosition();
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updatePosition]);

  function run(action?: () => void) {
    setOpen(false);
    action?.();
  }

  const popover = open ? (
    <div
      ref={popoverRef}
      className="fixed z-[110] w-56 rounded-lg border border-border bg-popover/100 p-1 shadow-xl ring-1 ring-border"
      style={{ left: position.left, bottom: position.bottom }}
      role="menu"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
        role="menuitem"
        onClick={() => run(onAddFiles)}
      >
        <ImagePlus className="size-4 text-muted-foreground" aria-hidden />
        Add photos & files
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
        role="menuitem"
        onClick={() => run(onCreateImage)}
      >
        <FileImage className="size-4 text-muted-foreground" aria-hidden />
        Create Image
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
        role="menuitem"
        onClick={() => run(onDeepResearch)}
      >
        <BrainCircuit className="size-4 text-muted-foreground" aria-hidden />
        Deep Research
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
        role="menuitem"
        onClick={() => run(onWebSearch)}
      >
        <Search className="size-4 text-muted-foreground" aria-hidden />
        Web search
      </button>
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={cn("relative shrink-0 self-stretch", className)}>
      <button
        type="button"
        className="flex h-full items-center rounded-md border border-border bg-background px-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden
        >
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      </button>
      {typeof document !== "undefined" && popover
        ? createPortal(popover, document.body)
        : popover}
    </div>
  );
}
