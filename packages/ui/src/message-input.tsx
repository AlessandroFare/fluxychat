import * as React from "react";
import type { FluxyChatAttachment } from "@fluxychat/sdk";
import { getActiveMentionAtCursor, mentionMatchesQuery } from "./mention-utils";

export interface MentionSuggestion {
  /** Handle inserted as @handle */
  handle: string;
  label?: string;
}

export interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onTyping?: (isTyping: boolean) => void;
  editingMessageId: number | null;
  editingValue: string;
  onEditingChange: (value: string) => void;
  replyToId: number | null;
  replyPreview: string | null;
  onCancelReply: () => void;
  pendingAttachments: FluxyChatAttachment[];
  onRemoveAttachment: (index: number) => void;
  onAppendAttachments: (next: FluxyChatAttachment[]) => void;
  onSubmit: () => void;
  /** User/agent handles suggested after typing `@` */
  mentionSuggestions?: MentionSuggestion[];
  /** Cap visible rows in the dropdown (default 8) */
  mentionMaxSuggestions?: number;
  /** Lowercased handles shown first while the menu is open (e.g. users typing). */
  mentionPrioritizeHandles?: string[];
  /**
   * When set (compose mode only), image/file/voice icons open a file picker then call this helper
   * (wire to `FluxyChatClient.uploadFile`). Without it, prompts for a demo URL behave as today.
   */
  uploadComposerFile?: (
    file: File,
    kindHint: "image" | "file" | "audio"
  ) => Promise<FluxyChatAttachment | null | void>;
}

function compareMentionsForAutocomplete(
  a: MentionSuggestion,
  b: MentionSuggestion,
  priorityIndex: Map<string, number>
): number {
  const ak = a.handle.toLowerCase();
  const bk = b.handle.toLowerCase();
  const ar = priorityIndex.has(ak) ? priorityIndex.get(ak)! : 10_000;
  const br = priorityIndex.has(bk) ? priorityIndex.get(bk)! : 10_000;
  if (ar !== br) return ar - br;
  return ak.localeCompare(bk);
}

function promptAttachment(
  kind: FluxyChatAttachment["kind"],
  onAppend: (a: FluxyChatAttachment[]) => void
) {
  if (kind === "image") {
    const url = window.prompt("Image URL");
    if (!url) return;
    const name = url.split("/").pop() || "image";
    onAppend([{ kind: "image", url, name }]);
    return;
  }
  if (kind === "file") {
    const url = window.prompt("File URL");
    if (!url) return;
    const name = url.split("/").pop() || "file";
    onAppend([{ kind: "file", url, name }]);
    return;
  }
  if (kind === "audio") {
    const url = window.prompt("Audio URL");
    if (!url) return;
    const name = url.split("/").pop() || "voice-message";
    onAppend([{ kind: "audio", url, name }]);
    return;
  }
  if (kind === "location") {
    const lat = window.prompt("Latitude");
    const lng = window.prompt("Longitude");
    if (!lat || !lng) return;
    const url = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
    const name = `Location (${lat}, ${lng})`;
    onAppend([{ kind: "location", url, name }]);
  }
}

/**
 * Composer area: draft vs edit, reply chip, demo URL attachments, @mention autocomplete.
 */
export function MessageInput({
  value,
  onChange,
  onTyping,
  editingMessageId,
  editingValue,
  onEditingChange,
  replyToId,
  replyPreview,
  onCancelReply,
  pendingAttachments,
  onRemoveAttachment,
  onAppendAttachments,
  onSubmit,
  mentionSuggestions = [],
  mentionMaxSuggestions = 8,
  mentionPrioritizeHandles = [],
  uploadComposerFile,
}: MessageInputProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);
  const uploadKindRef = React.useRef<"image" | "file" | "audio">("file");
  const [uploadBusy, setUploadBusy] = React.useState(false);
  const [mentionOpen, setMentionOpen] = React.useState(false);
  const [mentionHighlight, setMentionHighlight] = React.useState(0);
  const [mentionCtx, setMentionCtx] = React.useState<{ start: number; query: string } | null>(
    null
  );

  const isCompose = editingMessageId === null;
  const text = isCompose ? value : editingValue;

  const filteredMentions = React.useMemo(() => {
    if (!mentionCtx) return [];
    const q = mentionCtx.query;
    const filtered = mentionSuggestions.filter((s) =>
      mentionMatchesQuery(s.handle, s.label, q)
    );
    const priorityIndex = new Map(
      mentionPrioritizeHandles.map((h, i) => [String(h).toLowerCase(), i])
    );
    return [...filtered]
      .sort((a, b) => compareMentionsForAutocomplete(a, b, priorityIndex))
      .slice(0, mentionMaxSuggestions);
  }, [
    mentionCtx,
    mentionSuggestions,
    mentionMaxSuggestions,
    mentionPrioritizeHandles,
  ]);

  const applyMentionSelection = React.useCallback(
    (handle: string) => {
      if (!mentionCtx) return;
      const el = inputRef.current;
      const pos = el?.selectionStart ?? text.length;
      const tail = text.slice(pos);
      const inserted = `@${handle} `;
      const next = `${text.slice(0, mentionCtx.start)}${inserted}${tail}`;
      const caret = mentionCtx.start + inserted.length;

      if (isCompose) {
        onChange(next);
        onTyping?.(true);
      } else onEditingChange(next);

      setMentionOpen(false);
      setMentionCtx(null);

      queueMicrotask(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(caret, caret);
        }
      });
    },
    [
      mentionCtx,
      isCompose,
      text,
      onChange,
      onEditingChange,
      onTyping,
    ]
  );

  const mentionOptionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const syncMentionOpen = React.useCallback(() => {
    const el = inputRef.current;
    const pos = el?.selectionStart ?? text.length;
    const active = getActiveMentionAtCursor(text, pos);
    if (!active || !mentionSuggestions.length) {
      setMentionOpen(false);
      setMentionCtx(null);
      return;
    }
    const filtered = mentionSuggestions.filter((s) =>
      mentionMatchesQuery(s.handle, s.label, active.query)
    );
    if (!filtered.length) {
      setMentionOpen(false);
      setMentionCtx(null);
      return;
    }
    setMentionCtx(active);
    setMentionOpen(true);
    setMentionHighlight(0);
  }, [text, mentionSuggestions]);

  React.useEffect(() => {
    if (!mentionOpen || !filteredMentions.length) return;
    setMentionHighlight((h) => Math.min(h, filteredMentions.length - 1));
  }, [filteredMentions.length, mentionOpen]);

  React.useEffect(() => {
    if (!mentionOpen || !filteredMentions.length) return;
    const btn = mentionOptionRefs.current[mentionHighlight];
    btn?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [mentionHighlight, mentionOpen, filteredMentions.length]);

  const triggerComposerUpload = React.useCallback(
    (kindHint: "image" | "file" | "audio", fallbackKind: FluxyChatAttachment["kind"]) => {
      if (uploadComposerFile && editingMessageId === null) {
        uploadKindRef.current = kindHint;
        const el = uploadInputRef.current;
        if (el) {
          el.accept =
            kindHint === "image"
              ? "image/jpeg,image/png,image/gif,image/webp"
              : kindHint === "audio"
                ? "audio/webm,audio/mpeg,audio/mp3,audio/wav,.mp3,.webm,.wav"
                : "";
          el.click();
          return;
        }
      }
      promptAttachment(fallbackKind, onAppendAttachments);
    },
    [uploadComposerFile, editingMessageId, onAppendAttachments]
  );

  const onUploadInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !uploadComposerFile) return;
    setUploadBusy(true);
    void Promise.resolve(uploadComposerFile(f, uploadKindRef.current))
      .then((att) => {
        if (att) onAppendAttachments([att]);
      })
      .finally(() => setUploadBusy(false));
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (editingMessageId !== null) onEditingChange(v);
    else {
      onChange(v);
      onTyping?.(true);
    }
    queueMicrotask(syncMentionOpen);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mentionOpen || !filteredMentions.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionHighlight((i) => (i + 1) % filteredMentions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionHighlight((i) =>
        i <= 0 ? filteredMentions.length - 1 : i - 1
      );
    } else if (e.key === "Enter" && filteredMentions[mentionHighlight]) {
      e.preventDefault();
      applyMentionSelection(filteredMentions[mentionHighlight].handle);
    } else if (e.key === "Escape") {
      setMentionOpen(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      style={{
        padding: "8px 12px",
        borderTop: "1px solid #eee",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        position: "relative",
      }}
    >
      <input
        ref={uploadInputRef}
        type="file"
        tabIndex={-1}
        aria-hidden
        onChange={onUploadInputChange}
        style={{
          position: "absolute",
          width: 0,
          height: 0,
          opacity: 0,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
        }}
      />
      {mentionOpen && filteredMentions.length > 0 ? (
        <div
          role="listbox"
          id="fluxychat-mention-list"
          aria-label="Mention suggestions"
          style={{
            position: "absolute",
            bottom: "100%",
            left: 12,
            right: 12,
            marginBottom: 4,
            maxHeight: 220,
            overflowY: "auto",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            boxShadow: "0 4px 18px rgba(15,23,42,0.12)",
            zIndex: 20,
          }}
        >
          {filteredMentions.map((s, idx) => (
            <button
              key={`${s.handle}-${idx}`}
              ref={(el) => {
                mentionOptionRefs.current[idx] = el;
              }}
              type="button"
              role="option"
              aria-selected={idx === mentionHighlight}
              onMouseEnter={() => setMentionHighlight(idx)}
              onMouseDown={(ev) => {
                ev.preventDefault();
                applyMentionSelection(s.handle);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                background: idx === mentionHighlight ? "#eef2ff" : "transparent",
                color: "#111827",
              }}
            >
              <strong>@{s.handle}</strong>
              {s.label && s.label !== s.handle ? (
                <span style={{ color: "#6b7280", marginLeft: 8 }}>{s.label}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      {pendingAttachments.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            fontSize: 11,
            color: "#6b7280",
          }}
        >
          {pendingAttachments.map((a, idx) => (
            <div
              key={`${a.url}-${idx}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 6px",
                borderRadius: 999,
                background: "#e5e7eb",
                color: "#111827",
              }}
            >
              <span>
                {a.kind === "image" ? "🖼️" : "📎"} {a.name}
              </span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(idx)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 11,
                  color: "#6b7280",
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {replyToId !== null ? (
        <div
          style={{
            marginBottom: 2,
            padding: "4px 8px",
            borderRadius: 6,
            background: "rgba(15,23,42,0.9)",
            color: "#e5e7eb",
            fontSize: 11,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>
            Replying to #{replyToId}
            {replyPreview ? ` · ${replyPreview}` : ""}
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            style={{
              border: "none",
              background: "transparent",
              color: "#9ca3af",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            cancel
          </button>
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <input
          ref={inputRef}
          value={editingMessageId !== null ? editingValue : value}
          onChange={onInputChange}
          onKeyDown={onInputKeyDown}
          onBlur={() =>
            queueMicrotask(() => {
              setMentionOpen(false);
            })
          }
          onSelect={syncMentionOpen}
          onClick={syncMentionOpen}
          placeholder={editingMessageId !== null ? "Edit message…" : "Type a message…"}
          autoComplete="off"
          aria-autocomplete={mentionOpen ? "list" : "none"}
          aria-expanded={mentionOpen}
          aria-controls={mentionOpen ? "fluxychat-mention-list" : undefined}
          style={{
            flex: 1,
            padding: "6px 8px",
            borderRadius: 4,
            border: "1px solid #ddd",
            fontSize: 14,
          }}
        />
        <button
          type="button"
          onClick={() => triggerComposerUpload("image", "image")}
          disabled={uploadBusy}
          title={uploadComposerFile ? "Upload an image (requires JWT-backed client)" : "Attach image URL"}
          style={{
            padding: "4px 6px",
            borderRadius: 4,
            border: "1px solid #ddd",
            background: "#f9fafb",
            cursor: uploadBusy ? "default" : "pointer",
            fontSize: 12,
          }}
        >
          🖼️
        </button>
        <button
          type="button"
          onClick={() => triggerComposerUpload("file", "file")}
          disabled={uploadBusy}
          title={uploadComposerFile ? "Upload a file" : "Attach file URL"}
          style={{
            padding: "4px 6px",
            borderRadius: 4,
            border: "1px solid #ddd",
            background: "#f9fafb",
            cursor: uploadBusy ? "default" : "pointer",
            fontSize: 12,
          }}
        >
          📎
        </button>
        <button
          type="button"
          onClick={() => triggerComposerUpload("audio", "audio")}
          disabled={uploadBusy}
          title={uploadComposerFile ? "Upload audio" : "Attach audio URL"}
          style={{
            padding: "4px 6px",
            borderRadius: 4,
            border: "1px solid #ddd",
            background: "#f9fafb",
            cursor: uploadBusy ? "default" : "pointer",
            fontSize: 12,
          }}
        >
          🎤
        </button>
        <button
          type="button"
          onClick={() => promptAttachment("location", onAppendAttachments)}
          style={{
            padding: "4px 6px",
            borderRadius: 4,
            border: "1px solid #ddd",
            background: "#f9fafb",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          📍
        </button>
        <button
          type="submit"
          style={{
            padding: "6px 10px",
            borderRadius: 4,
            border: "none",
            background: "#111827",
            color: "white",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Send
        </button>
      </div>
    </form>
  );
}
