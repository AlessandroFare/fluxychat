"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "../lib/utils"

const COMMON_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀"] as const

export interface ReactionPickerProps {
  onReact?: (emoji: string) => void
  reactions?: readonly string[]
  className?: string
  /** When true, the picker is visible. */
  open: boolean
  /** Anchor rect to position against (from getBoundingClientRect). */
  anchorRect?: DOMRect | null
}

/**
 * Quick emoji picker that appears on message hover.
 * Renders as a floating row of common reactions.
 * Uses a portal to escape any overflow:hidden ancestors.
 */
export function ReactionPicker({
  onReact,
  reactions = COMMON_REACTIONS,
  className,
  open,
  anchorRect,
}: ReactionPickerProps) {
  const popoverRef = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState({ top: 0, left: 0 })

  React.useEffect(() => {
    if (!open || !anchorRect) return
    setPos({
      top: anchorRect.top - 44,
      left: anchorRect.left + anchorRect.width / 2,
    })
  }, [open, anchorRect])

  React.useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        // Let the parent handle closing
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  if (!open) return null

  const popover = (
    <div
      ref={popoverRef}
      role="toolbar"
      aria-label="Quick reactions"
      data-slot="reaction-picker"
      className={cn(
        "fixed z-[120] flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-border bg-background/95 p-1 shadow-lg backdrop-blur-sm",
        className
      )}
      style={{ top: pos.top, left: pos.left }}
    >
      {reactions.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="flex size-8 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onReact?.(emoji)}
          aria-label={`React with ${emoji}`}
        >
          <span aria-hidden>{emoji}</span>
        </button>
      ))}
    </div>
  )

  if (typeof document !== "undefined") {
    return createPortal(popover, document.body)
  }
  return popover
}
