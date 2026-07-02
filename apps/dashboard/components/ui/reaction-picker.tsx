"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

const DEFAULT_REACTIONS = ["👍", "❤️", "😂", "😮", "😢"] as const

const EMOJI_CATEGORIES: Record<string, string[]> = {
  Smileys: [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🙂", "🙃", "😉", "😊", "😇",
    "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "😋", "😛", "😜", "🤪", "😝",
    "🤗", "🤭", "🤫", "🤔", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥",
    "😌", "😔", "😪", "🤤", "😷", "🤒", "🤕", "🤢", "🤮", "🥵", "🥶", "😎",
    "🤓", "🧐", "😕", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "😦", "😧",
    "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫",
    "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹",
    "👺", "👻", "👽", "👾", "🤖",
  ],
  Gestures: [
    "👋", "🤚", "🖐", "✋", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙",
    "👈", "👉", "👆", "👇", "☝️", "✍️", "👏", "🙌", "👐", "🤲", "🤝", "🙏",
    "✊", "👊", "🤛", "🤜", "👎",
  ],
  Hearts: [
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕",
    "💞", "💓", "💗", "💖", "💘", "💝", "💟",
  ],
  "Party/Celebration": [
    "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🎖", "🏅", "🥳", "🎶", "🎵", "🎤",
    "🎬", "🎮", "🕹", "🎲", "🎯", "🎳", "🎪", "🎭", "🎨", "🖌", "🖨", "✏️",
    "✒️", "🖋", "🖊", "📝", "💼", "📁", "📂", "📎", "📌", "📍", "📏", "📐",
    "✂️", "🗃", "🗄", "🗑", "🔒", "🔓", "🔏", "🔐", "🔑", "🗝", "🔨", "⛏",
    "⚙️", "⚖️", "🔗", "⛓", "🧰", "🧲", "🧪", "🧫", "🧬", "🔬", "🔭", "📡",
    "💉", "💊", "🚪", "🛏", "🛋", "🚽", "🚿", "🛁", "🧴", "🧷", "🧹", "🧺",
    "🧻", "🧼", "🧽", "🧯", "🛒",
  ],
  Objects: [
    "📱", "💻", "⌨️", "🖥", "🖨", "🖱", "💾", "💿", "📷", "📸", "🎥",
    "📹", "🔍", "💡", "🔦", "🏮", "📔", "📕", "📖", "📗", "📘", "📙", "📚",
    "📓", "📒", "📃", "📜", "📄", "📰", "🗞", "📑", "🔖", "🏷", "💰", "💴",
    "💵", "💶", "💷", "💸", "💳", "🧾", "💹", "✉️", "📧", "📨", "📩", "📤",
    "📥", "📦", "📫", "📪", "📬", "📭", "📮", "📯", "📅", "📆",
    "🗓", "📇", "📈", "📉", "📊", "📋", "🖇", "✂️",
  ],
}

// Deduplicate emojis across categories
const _seen = new Set<string>()
for (const [cat, emojis] of Object.entries(EMOJI_CATEGORIES)) {
  EMOJI_CATEGORIES[cat] = emojis.filter((e) => {
    if (_seen.has(e)) return false
    _seen.add(e)
    return true
  })
}

export interface ReactionPickerProps {
  onReact?: (emoji: string) => void
  onClose?: () => void
  reactions?: readonly string[]
  className?: string
  /** When true, the picker is visible. */
  open: boolean
  /** Anchor rect to position against (from getBoundingClientRect). */
  anchorRect?: DOMRect | null
}

export function ReactionPicker({
  onReact,
  onClose,
  reactions = DEFAULT_REACTIONS,
  className,
  open,
  anchorRect,
}: ReactionPickerProps) {
  const popoverRef = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState({ top: 0, left: 0 })
  const [showFullPicker, setShowFullPicker] = React.useState(false)

  React.useEffect(() => {
    if (!open || !anchorRect) return
    setPos({
      top: anchorRect.top - 44,
      left: anchorRect.left + anchorRect.width / 2,
    })
    setShowFullPicker(false)
  }, [open, anchorRect])

  // Close on click outside
  React.useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose?.()
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open, onClose])

  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const handleReact = (emoji: string) => {
    onReact?.(emoji)
    setShowFullPicker(false)
  }

  const popover = (
    <div
      ref={popoverRef}
      role="toolbar"
      aria-label="Quick reactions"
      data-slot="reaction-picker"
      className={cn(
        "fixed z-[9999] flex flex-col items-center gap-0.5 rounded-full border border-border bg-background p-1 shadow-lg",
        showFullPicker && "rounded-2xl",
        className
      )}
      style={{ top: pos.top, left: pos.left, backgroundColor: "white" }}
    >
      {/* Default row */}
      <div className="flex items-center gap-0.5">
        {reactions.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="flex size-8 items-center justify-center rounded-full text-lg transition-transform duration-150 hover:scale-[1.3] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => handleReact(emoji)}
            aria-label={`React with ${emoji}`}
          >
            <span aria-hidden>{emoji}</span>
          </button>
        ))}
        {/* More button */}
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-full text-lg transition-transform duration-150 hover:scale-[1.3] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setShowFullPicker((prev) => !prev)}
          aria-label="More emojis"
        >
          <span aria-hidden>➕</span>
        </button>
      </div>

      {/* Full picker panel */}
      {showFullPicker ? (
        <div className="mt-1 max-h-64 w-80 overflow-y-auto rounded-xl border border-border bg-background p-2 shadow-inner" style={{ backgroundColor: "white" }}>
          {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
            <div key={category} className="mb-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </div>
              <div className="flex flex-wrap gap-0.5">
                {emojis.map((emoji, idx) => (
                  <button
                    key={`${emoji}-${idx}`}
                    type="button"
                    className="flex size-8 items-center justify-center rounded-md text-lg transition-transform duration-150 hover:scale-[1.3] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => handleReact(emoji)}
                    aria-label={`React with ${emoji}`}
                  >
                    <span aria-hidden>{emoji}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )

  if (typeof document !== "undefined") {
    return createPortal(popover, document.body)
  }
  return popover
}
