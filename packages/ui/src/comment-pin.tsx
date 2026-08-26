"use client";

import * as React from "react";

export interface CommentPinProps {
  x: number;
  y: number;
  count?: number;
  resolved?: boolean;
  onClick?: () => void;
}

export function CommentPin({ x, y, count = 1, resolved, onClick }: CommentPinProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -100%)",
        border: "none",
        borderRadius: 999,
        minWidth: 28,
        height: 28,
        padding: "0 8px",
        background: resolved ? "#64748b" : "#2563eb",
        color: "#fff",
        fontSize: 12,
        cursor: "pointer",
        zIndex: 45,
      }}
    >
      {count}
    </button>
  );
}
