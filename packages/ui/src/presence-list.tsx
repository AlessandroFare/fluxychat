import * as React from "react";

export interface PresenceListProps {
  onlineCount: number;
  userIds?: string[];
  /** Shown above the numeric count when `userIds` is empty */
  brandLabel?: string;
}

/** Compact strip: brand + aggregate presence + optional id chips. */
export function PresenceList({
  onlineCount,
  userIds = [],
  brandLabel = "Fluxychat",
}: PresenceListProps) {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderBottom: "1px solid #eee",
        fontSize: 12,
        color: "#555",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>{brandLabel}</span>
        <span style={{ flexShrink: 0 }}>{onlineCount} online</span>
      </div>
      {userIds.length > 0 ? (
        <div
          style={{
            marginTop: 6,
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
          }}
        >
          {userIds.map((uid) => (
            <span
              key={uid}
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "#eef2ff",
                color: "#4338ca",
                maxWidth: 160,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={uid}
            >
              {uid}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
