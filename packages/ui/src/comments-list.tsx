"use client";

import * as React from "react";
import type { FluxyCommentThread } from "@fluxy-chat/sdk";

export type CommentThreadFilter = "all" | "open" | "resolved";

function filterCommentThreads(
  threads: FluxyCommentThread[],
  filter: CommentThreadFilter,
): FluxyCommentThread[] {
  if (filter === "open") return threads.filter((thread) => !thread.resolved);
  if (filter === "resolved") return threads.filter((thread) => thread.resolved);
  return threads;
}

function commentThreadPreview(thread: FluxyCommentThread): string {
  const body = thread.comments[0]?.body?.trim();
  if (body) return body;
  return thread.metadata.quote?.trim() || "Comment";
}

export interface CommentsListProps {
  threads: FluxyCommentThread[];
  openId?: string | null;
  filter?: CommentThreadFilter;
  onSelect: (threadId: string) => void;
  emptyLabel?: string;
}

/** tldraw `CommentsList` / `CanvasCommentsSidebar` — thread rows, not chat. */
export function CommentsList({
  threads,
  openId,
  filter = "all",
  onSelect,
  emptyLabel = "No comments",
}: CommentsListProps) {
  const rows = filterCommentThreads(threads, filter);
  if (rows.length === 0) {
    return (
      <p data-testid="comments-list-empty" style={{ fontSize: 12, color: "#94a3b8", padding: "8px 0" }}>
        {emptyLabel}
      </p>
    );
  }
  return (
    <ul data-testid="comments-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {rows.map((thread) => (
        <li key={thread.id}>
          <button
            type="button"
            onClick={() => onSelect(thread.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              border: "none",
              background: openId === thread.id ? "#e2e8f0" : "transparent",
              borderRadius: 6,
              padding: "8px 10px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            <span style={{ color: thread.resolved ? "#64748b" : "#0f172a" }}>
              {commentThreadPreview(thread)}
            </span>
            <span style={{ display: "block", fontSize: 11, color: "#94a3b8" }}>
              {thread.resolved ? "Resolved" : "Open"} · {thread.comments.length}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
