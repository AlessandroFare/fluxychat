"use client";

import * as React from "react";

export interface InboxNotificationProps {
  kind: string;
  title: string;
  body?: string;
  receivedAt?: string;
  unread?: boolean;
  onClick?: () => void;
}

export function InboxNotification({
  kind,
  title,
  body,
  receivedAt,
  unread,
  onClick,
}: InboxNotificationProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "none",
        borderBottom: "1px solid #e2e8f0",
        background: unread ? "#eff6ff" : "transparent",
        padding: "10px 12px",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>{kind}</div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
      {body ? <div style={{ fontSize: 13, color: "#334155" }}>{body}</div> : null}
      {receivedAt ? (
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{receivedAt}</div>
      ) : null}
    </button>
  );
}
