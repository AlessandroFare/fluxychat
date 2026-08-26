"use client";

import * as React from "react";

export interface FeedMessageProps {
  userId: string;
  body: string;
  createdAt?: string;
  source?: string;
}

export function FeedMessage({ userId, body, createdAt, source }: FeedMessageProps) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderBottom: "1px solid #e2e8f0",
        fontSize: 13,
      }}
    >
      <div style={{ color: "#64748b", fontSize: 11 }}>
        {userId}
        {source ? ` · ${source}` : ""}
        {createdAt ? ` · ${createdAt}` : ""}
      </div>
      <div>{body}</div>
    </div>
  );
}
