import * as React from "react";

export interface AgentTypingIndicatorProps {
  visible: boolean;
  /** Label to show (default: "Assistant"). */
  label?: string;
  className?: string;
  "data-testid"?: string;
}

/**
 * "X is thinking…" indicator using a CSS shimmer bar.
 * Reduced-motion safe: the shimmer stops animating when
 * `prefers-reduced-motion: reduce` is set.
 */
export function AgentTypingIndicator({
  visible,
  label = "Assistant",
  className,
  "data-testid": testId,
}: AgentTypingIndicatorProps) {
  if (!visible) return null;

  return (
    <div
      className={className}
      data-testid={testId}
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <strong>{label}</strong> is thinking…
      </span>
    </div>
  );
}
