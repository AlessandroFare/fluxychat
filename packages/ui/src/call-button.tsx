"use client";

import * as React from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { cn } from "./lib/utils";
import { Button } from "./primitives/button";

export interface CallButtonProps {
  /** Whether a call is currently active */
  isActive?: boolean;
  /** Voice-only vs video call */
  mode?: "voice" | "video";
  disabled?: boolean;
  className?: string;
  onStart?: () => void;
  onEnd?: () => void;
  /** Accessible label override */
  label?: string;
}

/**
 * CP-063: Stream-style call trigger — wraps voice/video stage entry points.
 */
export function CallButton({
  isActive = false,
  mode = "voice",
  disabled = false,
  className,
  onStart,
  onEnd,
  label,
}: CallButtonProps) {
  const Icon = mode === "video" ? Video : Phone;
  const defaultLabel = isActive
    ? "End call"
    : mode === "video"
      ? "Start video call"
      : "Start voice call";

  return (
    <Button
      type="button"
      variant={isActive ? "destructive" : "outline"}
      size="sm"
      disabled={disabled}
      className={cn("gap-1.5", className)}
      aria-label={label || defaultLabel}
      data-testid="call-button"
      onClick={() => (isActive ? onEnd?.() : onStart?.())}
    >
      {isActive ? <PhoneOff className="size-4" aria-hidden /> : <Icon className="size-4" aria-hidden />}
      <span className="hidden sm:inline">{label || defaultLabel}</span>
    </Button>
  );
}
