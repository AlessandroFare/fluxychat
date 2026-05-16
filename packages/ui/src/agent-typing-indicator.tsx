import * as React from "react";

export interface AgentTypingIndicatorProps {
  visible: boolean;
  /** Defaults to “Assistant”. */
  label?: string;
}

/** Lightweight “assistant is drafting…” cue (pairs with SDK `agentTyping`). */
export function AgentTypingIndicator({
  visible,
  label = "Assistant",
}: AgentTypingIndicatorProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        fontSize: 11,
        color: "#93c5fd",
        padding: "4px 0",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#93c5fd",
          animation: "fc-pulse 1s ease-in-out infinite",
        }}
      />
      <span>
        <strong>{label}</strong> is thinking…
      </span>
      <style>{`@keyframes fc-pulse { 0%,100%{opacity:.35} 50%{opacity:1} }`}</style>
    </div>
  );
}
