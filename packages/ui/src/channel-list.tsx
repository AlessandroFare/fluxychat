import * as React from "react";
import { formatOccupancyCaption } from "./room-info";

export interface ChannelListRoom {
  id: string;
  name?: string;
  unreadCount?: number;
  /** Ably Sidebar occupancy: members currently in presence. */
  presenceMembers?: number;
  /** Ably Sidebar occupancy: socket connections watching. */
  connections?: number;
  /** Stream `channel.mute()`. */
  muted?: boolean;
}

export interface ChannelListProps {
  channels: ChannelListRoom[];
  activeId?: string;
  disabled?: boolean;
  onSelect: (roomId: string) => void;
  title?: string;
  /** Ably Sidebar collapsed (avatar / initials only). */
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onAddRoom?: () => void;
  onLeaveRoom?: (roomId: string) => void;
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
  return (label.slice(0, 2) || "?").toUpperCase();
}

/** Room sidebar with unread badges (Wire to `useRooms` results + active room). */
export function ChannelList({
  channels,
  activeId,
  disabled = false,
  onSelect,
  title = "Rooms",
  isCollapsed = false,
  onToggleCollapse,
  onAddRoom,
  onLeaveRoom,
}: ChannelListProps) {
  return (
    <div style={{ padding: "8px 0" }} data-testid="channel-list" data-collapsed={isCollapsed ? "true" : "false"}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#6b7280",
          padding: "0 12px 6px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ flex: 1 }}>
          {isCollapsed ? "" : `${title}${channels.length ? ` (${channels.length})` : ""}`}
        </span>
        {onAddRoom && !isCollapsed ? (
          <button
            type="button"
            onClick={onAddRoom}
            aria-label="Add room"
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 14 }}
          >
            +
          </button>
        ) : null}
        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expand rooms" : "Collapse rooms"}
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11 }}
          >
            {isCollapsed ? "»" : "«"}
          </button>
        ) : null}
      </div>
      {channels.length === 0 && !isCollapsed ? (
        <p style={{ fontSize: 12, color: "#9ca3af", padding: "8px 12px" }} data-testid="channel-list-empty">
          Select a room to start chatting
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {channels.map((room) => {
            const label = room.name || room.id;
            const occupancy = formatOccupancyCaption({
              presenceMembers: room.presenceMembers,
              connections: room.connections,
            });
            return (
              <div
                key={room.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  background: activeId === room.id ? "#111827" : "transparent",
                  borderRadius: 6,
                  paddingRight: onLeaveRoom && !isCollapsed ? 4 : 0,
                }}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(room.id)}
                  title={occupancy ? `${label} · ${occupancy}` : label}
                  style={{
                    textAlign: "left",
                    padding: isCollapsed ? "8px" : "8px 12px",
                    border: "none",
                    background: "transparent",
                    color: activeId === room.id ? "#fff" : "#374151",
                    cursor: disabled ? "not-allowed" : "pointer",
                    fontSize: 13,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {isCollapsed ? initials(label) : label}
                    {!isCollapsed && room.muted ? " · muted" : ""}
                  </span>
                  {!isCollapsed && typeof room.unreadCount === "number" && room.unreadCount > 0 ? (
                    <span
                      style={{
                        minWidth: 20,
                        padding: "1px 6px",
                        borderRadius: 999,
                        fontSize: 11,
                        background: "var(--brand)",
                        color: "#fff",
                        fontWeight: 600,
                      }}
                    >
                      {room.unreadCount > 99 ? "99+" : room.unreadCount}
                    </span>
                  ) : null}
                </button>
                {onLeaveRoom && !isCollapsed ? (
                  <button
                    type="button"
                    aria-label={`Leave ${label}`}
                    onClick={() => onLeaveRoom(room.id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: activeId === room.id ? "#fff" : "#9ca3af",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
