"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { useThread } from "@fluxy-chat/react";
import type { FluxyChatClient } from "@fluxy-chat/sdk";
import { Button } from "./ui";

interface RoomThreadPaneProps {
  roomId: string;
  threadParentId: number;
  client?: FluxyChatClient | null;
  onClose: () => void;
}

export function RoomThreadPane({
  roomId,
  threadParentId,
  client,
  onClose,
}: RoomThreadPaneProps) {
  const {
    messages,
    sendMessage,
    loadPrevious,
    hasPrevious,
    isLoadingPrevious,
  } = useThread({ roomId, threadParentId, client: client ?? undefined });
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSend() {
    const text = draft.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setSendError(null);
    try {
      await sendMessage(text);
      setDraft("");
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : "Could not send reply");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <aside
      className="flex w-full shrink-0 flex-col rounded-xl border border-border bg-card lg:w-80"
      data-testid="room-thread-pane"
      aria-label={`Thread ${threadPaneLabel(threadParentId)}`}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <p className="text-sm font-medium">Thread</p>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          onClick={onClose}
          aria-label="Close thread"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      {hasPrevious ? (
        <button
          type="button"
          className="border-b border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40"
          disabled={isLoadingPrevious}
          onClick={() => void loadPrevious()}
        >
          {isLoadingPrevious ? "Loading…" : "Load earlier replies"}
        </button>
      ) : null}
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {messages.length === 0 ? (
          <li className="text-xs text-muted-foreground">No replies yet. Send one below.</li>
        ) : (
          messages.map((m) => (
            <li key={m.id} className="rounded-md bg-muted/40 px-2 py-1.5">
              <p className="text-[11px] text-muted-foreground">{m.userId}</p>
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
            </li>
          ))
        )}
      </ul>
      {sendError ? (
        <p className="px-3 text-xs text-amber-700" role="alert">
          {sendError}
        </p>
      ) : null}
      <form
        className="flex gap-2 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Reply in thread"
          aria-label="Reply in thread"
        />
        <Button type="submit" size="sm" disabled={!draft.trim() || isSending}>
          {isSending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : "Send"}
        </Button>
      </form>
    </aside>
  );
}

function threadPaneLabel(id: number): string {
  return `#${id}`;
}
