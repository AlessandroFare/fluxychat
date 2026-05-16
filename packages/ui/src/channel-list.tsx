import * as React from "react";

export interface ChannelListRoom {
  id: string;
  name?: string;
  unreadCount?: number;
}

export interface ChannelListProps {
  channels: ChannelListRoom[];
  activeId?: string;
  disabled?: boolean;
  onSelect: (roomId: string) => void;
  title?: string;
}

/** Room sidebar with unread badges (Wire to `useRooms` results + active room). */
export function ChannelList({
  channels,
  activeId,
  disabled = false,
  onSelect,
  title = "Rooms",
}: ChannelListProps) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", padding: "0 12px 6px" }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {channels.map((room) => (
          <button
            key={room.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(room.id)}
            style={{
              textAlign: "left",
              padding: "8px 12px",
              border: "none",
              background:
                activeId === room.id ? "#111827" : "transparent",
              color: activeId === room.id ? "#fff" : "#374151",
              cursor: disabled ? "not-allowed" : "pointer",
              fontSize: 13,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              borderRadius: 6,
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {room.name || room.id}
            </span>
            {typeof room.unreadCount === "number" && room.unreadCount > 0 ? (
              <span
                style={{
                  minWidth: 20,
                  padding: "1px 6px",
                  borderRadius: 999,
                  fontSize: 11,
                  background: "#ff725e",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {room.unreadCount > 99 ? "99+" : room.unreadCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
