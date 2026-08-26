"use client";

import * as React from "react";

export interface SelectionRect {
  userId: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
  color?: string;
  label?: string;
}

export interface SelectionsProps {
  selections: SelectionRect[];
  selfUserId?: string;
}

export function Selections({ selections, selfUserId }: SelectionsProps) {
  return (
    <>
      {selections
        .filter((s) => (!selfUserId || s.userId !== selfUserId) && s.x2 !== s.x && s.y2 !== s.y)
        .map((s) => {
          const left = Math.min(s.x, s.x2);
          const top = Math.min(s.y, s.y2);
          const width = Math.abs(s.x2 - s.x);
          const height = Math.abs(s.y2 - s.y);
          const color = s.color || "#2563eb";
          return (
            <div
              key={s.userId}
              aria-hidden
              style={{
                position: "absolute",
                left,
                top,
                width,
                height,
                border: `2px solid ${color}`,
                background: `${color}22`,
                pointerEvents: "none",
                zIndex: 40,
              }}
            >
              {s.label ? (
                <span
                  style={{
                    position: "absolute",
                    top: -18,
                    left: 0,
                    fontSize: 11,
                    color: "#fff",
                    background: color,
                    padding: "0 6px",
                    borderRadius: 4,
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.label}
                </span>
              ) : null}
            </div>
          );
        })}
    </>
  );
}
