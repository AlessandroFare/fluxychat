"use client";

import * as React from "react";
import type { FluxyComment, FluxyCommentThread } from "@fluxy-chat/sdk";

export interface CommentProps {
  comment: FluxyComment;
  onEdit?: (body: string) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onReact?: (emoji: string) => void | Promise<void>;
}

export function Comment({ comment, onEdit, onDelete, onReact }: CommentProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(comment.body);

  async function save() {
    const body = draft.trim();
    if (!body || !onEdit) return;
    await onEdit(body);
    setEditing(false);
  }

  return (
    <article style={{ fontSize: 13, marginBottom: 8 }}>
      <strong>{comment.userId}</strong>
      <span style={{ color: "#94a3b8", marginLeft: 8, fontSize: 11 }}>{comment.createdAt}</span>
      {comment.editedAt ? (
        <span style={{ color: "#94a3b8", marginLeft: 6, fontSize: 11 }}>edited</span>
      ) : null}
      {editing ? (
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            style={{ flex: 1, padding: "4px 6px", border: "1px solid #cbd5e1", borderRadius: 6 }}
          />
          <button type="button" onClick={() => void save()}>
            Save
          </button>
          <button type="button" onClick={() => { setEditing(false); setDraft(comment.body); }}>
            Cancel
          </button>
        </div>
      ) : (
        <p style={{ margin: "4px 0 0" }}>{comment.body}</p>
      )}
      {onEdit && !editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={{ marginTop: 2, marginRight: 8, fontSize: 11, background: "none", border: 0, color: "#64748b" }}
        >
          Edit
        </button>
      ) : null}
      {onDelete && !editing ? (
        <button
          type="button"
          onClick={() => void onDelete()}
          style={{ marginTop: 2, fontSize: 11, background: "none", border: 0, color: "#64748b" }}
        >
          Delete
        </button>
      ) : null}
      {onReact && !editing ? (
        <span style={{ marginLeft: 8 }}>
          {["👍", "👀", "✅"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => void onReact(emoji)}
              style={{ marginRight: 4, fontSize: 11, background: "none", border: 0, cursor: "pointer" }}
            >
              {emoji}
              {comment.reactions?.[emoji]?.length ? ` ${comment.reactions[emoji].length}` : ""}
            </button>
          ))}
        </span>
      ) : null}
    </article>
  );
}

export interface ThreadComposerProps {
  placeholder?: string;
  disabled?: boolean;
  onSubmit: (body: string) => void | Promise<void>;
}

export function ThreadComposer({ placeholder = "Write a comment…", disabled, onSubmit }: ThreadComposerProps) {
  const [draft, setDraft] = React.useState("");

  async function submit() {
    const body = draft.trim();
    if (!body || disabled) return;
    setDraft("");
    await onSubmit(body);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      style={{ display: "flex", gap: 8 }}
    >
      <input
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 8 }}
      />
      <button type="submit" disabled={disabled} style={{ padding: "6px 10px", border: 0, borderRadius: 8, background: "#2563eb", color: "#fff" }}>
        Send
      </button>
    </form>
  );
}

export interface ThreadProps {
  thread: FluxyCommentThread;
  onReply?: (body: string) => void | Promise<void>;
  onResolve?: (resolved: boolean) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onEditComment?: (commentId: string, body: string) => void | Promise<void>;
  onDeleteComment?: (commentId: string) => void | Promise<void>;
  onReact?: (commentId: string, emoji: string) => void | Promise<void>;
}

export function Thread({ thread, onReply, onResolve, onDelete, onEditComment, onDeleteComment, onReact }: ThreadProps) {
  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: 12,
        background: thread.resolved ? "#f8fafc" : "#fff",
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8, fontSize: 12, color: "#64748b" }}>
        <span>{thread.resolved ? "Resolved" : "Open"}</span>
        <span style={{ display: "flex", gap: 8 }}>
          {onResolve ? (
            <button type="button" onClick={() => void onResolve(!thread.resolved)}>
              {thread.resolved ? "Reopen" : "Resolve"}
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" onClick={() => void onDelete()}>
              Delete
            </button>
          ) : null}
        </span>
      </header>
      {thread.comments.map((comment) => (
        <Comment
          key={comment.id}
          comment={comment}
          onEdit={onEditComment ? (body) => onEditComment(comment.id, body) : undefined}
          onDelete={onDeleteComment ? () => onDeleteComment(comment.id) : undefined}
          onReact={onReact ? (emoji) => onReact(comment.id, emoji) : undefined}
        />
      ))}
      {onReply ? <ThreadComposer onSubmit={onReply} placeholder="Reply…" /> : null}
    </section>
  );
}

export interface FloatingComposerProps {
  x: number;
  y: number;
  onSubmit: (body: string) => void | Promise<void>;
  onCancel?: () => void;
}

export function FloatingComposer({ x, y, onSubmit, onCancel }: FloatingComposerProps) {
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(8px, 8px)",
        width: 260,
        padding: 10,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(15,23,42,0.12)",
        zIndex: 50,
      }}
    >
      <ThreadComposer
        placeholder="Pin a comment…"
        onSubmit={async (body) => {
          await onSubmit(body);
        }}
      />
      {onCancel ? (
        <button type="button" onClick={onCancel} style={{ marginTop: 6, fontSize: 12, background: "none", border: 0, color: "#64748b" }}>
          Cancel
        </button>
      ) : null}
    </div>
  );
}
