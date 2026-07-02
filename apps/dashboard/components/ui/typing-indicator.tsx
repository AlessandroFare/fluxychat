"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface TypingIndicatorProps {
  visible: boolean
  /** Display name of the person typing. */
  name?: string
  /** Avatar element to show next to the dots. */
  avatar?: React.ReactNode
  className?: string
  "data-testid"?: string
}

/**
 * Animated typing dots indicator with optional avatar.
 * Shows three bouncing dots with staggered delays.
 * Respects `prefers-reduced-motion` via CSS animation.
 */
export function TypingIndicator({
  visible,
  name,
  avatar,
  className,
  "data-testid": testId,
}: TypingIndicatorProps) {
  if (!visible) return null

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      data-testid={testId}
      role="status"
      aria-live="polite"
      aria-label={name ? `${name} is typing` : "Someone is typing"}
    >
      {avatar ? (
        <div className="flex shrink-0 items-end" aria-hidden>
          {avatar}
        </div>
      ) : null}
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-3 py-2.5">
        <span className="inline-flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-2 animate-bounce rounded-full bg-muted-foreground/70"
              style={{
                animationDelay: `${i * 150}ms`,
                animationDuration: "1s",
              }}
            />
          ))}
        </span>
        {name ? (
          <span className="ml-1 text-xs text-muted-foreground">
            {name} is typing…
          </span>
        ) : null}
      </div>
    </div>
  )
}
