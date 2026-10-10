"use client";

import * as React from "react";
import { orderAvatarStack, type AvatarStackPerson } from "./avatar-stack";
import { watchingFromOccupancy } from "./room-info";

export interface ParticipantListPerson extends AvatarStackPerson {}

export interface ParticipantListProps {
  people: ParticipantListPerson[];
  selfId?: string;
  /** Socket count when it differs from people.length (watching vs in chat). */
  connections?: number;
}

export function ParticipantList({ people, selfId, connections }: ParticipantListProps) {
  const { self, others } = orderAvatarStack(people, selfId);
  const rows = self ? [self, ...others] : others;
  const watching = watchingFromOccupancy({ connections, presenceMembers: people.length }) ?? 0;

  return (
    <div data-testid="participant-list" aria-label={`${people.length} in chat`}>
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Nobody in chat yet.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rows.map((person) => {
            const isSelf = Boolean(self && person.userId === self.userId);
            return (
              <li
                key={person.userId}
                data-self={isSelf ? "true" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 0",
                  fontSize: 13,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: person.color || "#2563eb",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {(person.name || person.userId).slice(0, 1).toUpperCase()}
                </span>
                <span>{person.name || person.userId}</span>
                {isSelf ? (
                  <span style={{ fontSize: 11, color: "#64748b" }}>(you)</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {watching > 0 ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#64748b" }}>
          {watching} watching
        </p>
      ) : null}
    </div>
  );
}
