"use client";

import * as React from "react";

export interface AvatarStackPerson {
  userId: string;
  name?: string;
  color?: string;
}

export interface AvatarStackProps {
  people: AvatarStackPerson[];
  /** Spaces avatar stack: self first, then others, then +N. */
  selfId?: string;
  max?: number;
}

export function orderAvatarStack(
  people: AvatarStackPerson[],
  selfId?: string,
): { self: AvatarStackPerson | null; others: AvatarStackPerson[] } {
  const id = selfId?.trim() ?? "";
  if (!id) return { self: null, others: people };
  const self = people.find((person) => person.userId === id) ?? null;
  const others = people.filter((person) => person.userId !== id);
  return { self, others };
}

export function AvatarStack({ people, selfId, max = 5 }: AvatarStackProps) {
  const { self, others } = orderAvatarStack(people, selfId);
  const selfSlots = self ? 1 : 0;
  const otherBudget = Math.max(max - selfSlots, 0);
  const shownOthers = others.slice(0, otherBudget);
  const extra = others.length - shownOthers.length;
  const shown = self ? [self, ...shownOthers] : shownOthers;

  return (
    <div style={{ display: "flex", alignItems: "center" }} aria-label={`${people.length} in room`}>
      {shown.map((person, index) => {
        const isSelf = Boolean(self && person.userId === self.userId);
        return (
          <span
            key={person.userId}
            title={person.name || person.userId}
            data-self={isSelf ? "true" : undefined}
            style={{
              width: 28,
              height: 28,
              marginLeft: index === 0 ? 0 : -8,
              borderRadius: 999,
              border: isSelf ? "2px solid #0f172a" : "2px solid #fff",
              boxShadow: isSelf ? "0 0 0 1px #fff" : undefined,
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
        );
      })}
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
