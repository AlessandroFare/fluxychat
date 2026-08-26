"use client";

import * as React from "react";
import { prefersReducedMotion, stepSpring, type SpringState } from "./cursor-spring";

const DEFAULT_COLORS = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed"];

export interface CursorPresence {
  userId: string;
  x: number;
  y: number;
  color?: string;
  label?: string;
}

export interface CursorProps {
  cursor: CursorPresence;
  color?: string;
}

export function Cursor({ cursor, color }: CursorProps) {
  const fill = color || cursor.color || DEFAULT_COLORS[hashHue(cursor.userId) % DEFAULT_COLORS.length];
  const reduced = prefersReducedMotion();
  const targetRef = React.useRef({ x: cursor.x, y: cursor.y });
  targetRef.current = { x: cursor.x, y: cursor.y };
  const stateRef = React.useRef<SpringState>({ x: cursor.x, y: cursor.y, vx: 0, vy: 0 });
  const nodeRef = React.useRef<HTMLDivElement | null>(null);
  const timeRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (reduced) return undefined;
    let frame = 0;
    timeRef.current = 0;
    function tick(now: number) {
      const last = timeRef.current || now;
      timeRef.current = now;
      const dt = (now - last) / 1000;
      const next = stepSpring(stateRef.current, targetRef.current.x, targetRef.current.y, dt);
      stateRef.current = next;
      const node = nodeRef.current;
      if (node) {
        node.style.left = `${next.x}px`;
        node.style.top = `${next.y}px`;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [reduced]);

  return (
    <div
      ref={nodeRef}
      aria-hidden
      style={{
        position: "absolute",
        left: cursor.x,
        top: cursor.y,
        pointerEvents: "none",
        transform: "translate(-2px, -2px)",
        zIndex: 50,
        willChange: reduced ? undefined : "left, top",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M5.5 3.2 19 12.4l-6.2 1.4 2.6 6.6-2.8 1.1-2.6-6.6L5.5 3.2Z"
          fill={fill}
          stroke="#0f172a"
          strokeWidth="1"
        />
      </svg>
      {cursor.label ? (
        <span
          style={{
            display: "block",
            marginTop: 2,
            padding: "1px 6px",
            borderRadius: 4,
            background: fill,
            color: "#fff",
            fontSize: 11,
            whiteSpace: "nowrap",
          }}
        >
          {cursor.label}
        </span>
      ) : null}
    </div>
  );
}

export interface CursorsProps {
  cursors: CursorPresence[];
  selfUserId?: string;
}

export function Cursors({ cursors, selfUserId }: CursorsProps) {
  return (
    <>
      {cursors
        .filter((c) => !selfUserId || c.userId !== selfUserId)
        .map((cursor) => (
          <Cursor key={cursor.userId} cursor={cursor} />
        ))}
    </>
  );
}

function hashHue(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}
