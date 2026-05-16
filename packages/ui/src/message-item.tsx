import * as React from "react";
import type { FluxyChatMessage } from "@fluxychat/sdk";
import { renderContentWithMentions } from "./render-content-with-mentions";

export interface MessageItemProps {
  message: FluxyChatMessage;
  variant?: "user" | "agent";
  agentLabel?: string;
  reactions?: Record<string, number>;
  seenByUserIds?: string[];
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReact?: (emoji: string) => void;
}

function OgPreviewCard({ preview }: { preview: NonNullable<FluxyChatMessage["preview"]> }) {
  let hostname = preview.url;
  try {
    hostname = new URL(preview.url).hostname;
  } catch {
    /* keep raw */
  }

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "block",
        marginTop: 4,
        textDecoration: "none",
        color: "#111827",
      }}
    >
      <div
        style={{
          borderRadius: 6,
          border: "1px solid #e5e7eb",
          background: "white",
          padding: 6,
          display: "flex",
          gap: 8,
          maxWidth: 320,
        }}
      >
        {preview.imageUrl ? (
          <img
            src={preview.imageUrl}
            alt={preview.title ?? ""}
            style={{
              width: 48,
              height: 48,
              objectFit: "cover",
              borderRadius: 4,
            }}
          />
        ) : null}
        <div style={{ flex: 1 }}>
          {preview.title ? (
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 2,
                color: "#111827",
              }}
            >
              {preview.title}
            </div>
          ) : null}
          {preview.description ? (
            <div
              style={{
                fontSize: 11,
                color: "#6b7280",
                maxHeight: 32,
                overflow: "hidden",
              }}
            >
              {preview.description}
            </div>
          ) : null}
          <div
            style={{
              fontSize: 10,
              color: "#9ca3af",
              marginTop: 2,
            }}
          >
            {hostname}
          </div>
        </div>
      </div>
    </a>
  );
}

/** Single bubble: threading, OG preview, reactions, read receipts; optional AI badge. */
export function MessageItem({
  message: m,
  variant = "user",
  agentLabel = "AI",
  reactions,
  seenByUserIds,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: MessageItemProps) {
  const resolvedVariant =
    variant === "agent"
      ? "agent"
      : m.senderId && m.senderId !== m.userId
        ? "agent"
        : "user";

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: "#777", display: "flex", gap: 6, alignItems: "center" }}>
        <span>{m.userId}</span>
        {resolvedVariant === "agent" ? (
          <span
            style={{
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: 0.06,
              padding: "1px 6px",
              borderRadius: 4,
              background: "#312e81",
              color: "#e0e7ff",
            }}
          >
            {agentLabel}
          </span>
        ) : null}
      </div>
      <div
        style={{
          display: "inline-flex",
          alignItems: "flex-end",
          gap: 6,
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "8px 10px",
            borderRadius: 14,
            background: resolvedVariant === "agent" ? "#1e293b" : "#f3f4f6",
            boxShadow: "0 1px 2px rgba(15,23,42,0.18)",
            maxWidth: 320,
            color: resolvedVariant === "agent" ? "#e5e7eb" : "#111827",
            fontSize: 14,
            lineHeight: 1.4,
            border:
              resolvedVariant === "agent" ? "1px solid rgba(99,102,241,0.35)" : undefined,
          }}
        >
          {m.parentId ? (
            <div
              style={{
                fontSize: 10,
                color: "#9ca3af",
                marginBottom: 2,
              }}
            >
              Replying to #{m.parentId}
            </div>
          ) : null}
          <div>
            {renderContentWithMentions(m.content)}
            {m.streaming ? (
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 14,
                  marginLeft: 4,
                  verticalAlign: "text-bottom",
                  borderRadius: 2,
                  background: "currentColor",
                  opacity: 0.55,
                }}
              />
            ) : null}
          </div>
          {m.editedAt && !m.streaming ? (
            <div
              style={{
                fontSize: 10,
                color: "#9ca3af",
                marginTop: 4,
              }}
            >
              edited
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {onReact ? (
            <button
              type="button"
              onClick={() => onReact("👍")}
              style={{
                border: "none",
                background: "transparent",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              👍
            </button>
          ) : null}
          {onReply ? (
            <button
              type="button"
              onClick={onReply}
              style={{
                border: "none",
                background: "transparent",
                fontSize: 10,
                color: "#6b7280",
                cursor: "pointer",
              }}
            >
              reply
            </button>
          ) : null}
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              style={{
                border: "none",
                background: "transparent",
                fontSize: 10,
                color: "#6b7280",
                cursor: "pointer",
              }}
            >
              edit
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              style={{
                border: "none",
                background: "transparent",
                fontSize: 10,
                color: "#b91c1c",
                cursor: "pointer",
              }}
            >
              delete
            </button>
          ) : null}
        </div>
      </div>
      {m.attachments && m.attachments.length > 0 ? (
        <div
          style={{
            marginTop: 4,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {m.attachments.map((a) => {
            if (a.kind === "image") {
              return (
                <img
                  key={a.url}
                  src={a.url}
                  alt={a.name}
                  style={{
                    maxWidth: 280,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                  }}
                />
              );
            }
            if (a.kind === "audio") {
              return (
                <audio key={a.url} controls src={a.url} style={{ maxWidth: 280 }}>
                  Your browser does not support the audio element.
                </audio>
              );
            }
            if (a.kind === "location") {
              return (
                <a
                  key={a.url}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12,
                    color: "#2563eb",
                    textDecoration: "none",
                  }}
                >
                  📍 {a.name || "View location"}
                </a>
              );
            }
            return (
              <a
                key={a.url}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 12,
                  color: "#2563eb",
                  textDecoration: "none",
                }}
              >
                📎 {a.name}
              </a>
            );
          })}
        </div>
      ) : null}
      {m.preview ? <OgPreviewCard preview={m.preview} /> : null}
      {reactions ? (
        <div
          style={{
            marginTop: 4,
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
          }}
        >
          {Object.entries(reactions).map(([emoji, count]) => (
            <span
              key={emoji}
              style={{
                fontSize: 11,
                background: "rgba(15,23,42,0.6)",
                color: "#e5e7eb",
                borderRadius: 999,
                padding: "2px 6px",
              }}
            >
              {emoji} {count}
            </span>
          ))}
        </div>
      ) : null}
      {seenByUserIds && seenByUserIds.length > 0 ? (
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
          Seen by {seenByUserIds.join(", ")}
        </div>
      ) : null}
    </div>
  );
}
