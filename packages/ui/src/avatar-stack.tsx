"use client";

import * as React from "react";

export interface AvatarStackPerson {
  userId: string;
  name?: string;
  color?: string;
}

export interface AvatarStackProps {
  people: AvatarStackPerson[];
  max?: number;
}

export function AvatarStack({ people, max = 5 }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div style={{ display: "flex", alignItems: "center" }} aria-label={`${people.length} in room`}>
      {shown.map((person, index) => (
        <span
          key={person.userId}
          title={person.name || person.userId}
          style={{
            width: 28,
            height: 28,
            marginLeft: index === 0 ? 0 : -8,
            borderRadius: 999,
            border: "2px solid #fff",
            background: person.color || hashColor(person.userId),
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: shown.length - index,
          }}
        >
          {(person.name || person.userId).slice(0, 1).toUpperCase()}
        </span>
      ))}
      {extra > 0 ? (
        <span style={{ marginLeft: 6, fontSize: 12, color: "#64748b" }}>+{extra}</span>
      ) : null}
    </div>
  );
}

function hashColor(value: string): string {
  const colors = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed"];
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}
