"use client";

import * as React from "react";

export interface RoomInfoOccupancy {
  connections?: number;
  presenceMembers?: number;
}

export interface RoomInfoProps {
  roomName: string;
  occupancy?: RoomInfoOccupancy;
  connections?: number;
  presenceMembers?: number;
}

/** Extra sockets beyond presence members (Ably kit “watching”). */
export function watchingFromOccupancy(input: {
  connections?: number;
  presenceMembers?: number;
}): number | undefined {
  if (input.connections == null) return undefined;
  if (input.presenceMembers == null) return input.connections;
  return Math.max(0, input.connections - input.presenceMembers);
}

export function formatOccupancyCaption(input: {
  connections?: number;
  presenceMembers?: number;
}): string | null {
  const parts: string[] = [];
  if (input.presenceMembers != null) parts.push(`${input.presenceMembers} in chat`);
  const watching = watchingFromOccupancy(input);
  if (watching != null && watching > 0) parts.push(`${watching} watching`);
  return parts.length ? parts.join(" · ") : null;
}

/** Ably Chat UI Kit `RoomInfo` — occupancy as “in chat” vs “watching”. */
export function formatRoomInfoCaption(input: {
  roomName: string;
  connections?: number;
  presenceMembers?: number;
}): string {
  const occupancy = formatOccupancyCaption(input);
  return occupancy ? `${input.roomName.trim() || "Room"} · ${occupancy}` : input.roomName.trim() || "Room";
}

export function RoomInfo({
  roomName,
  occupancy,
  connections,
  presenceMembers,
}: RoomInfoProps) {
  const caption = formatRoomInfoCaption({
    roomName,
    connections: connections ?? occupancy?.connections,
    presenceMembers: presenceMembers ?? occupancy?.presenceMembers,
  });
  return (
    <div
      data-testid="room-info"
      style={{
        padding: "8px 12px",
        borderBottom: "1px solid #5c5c5c",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {caption}
    </div>
  );
}
