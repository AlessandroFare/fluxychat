"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";

export interface MessageVersionItem {
  id: number;
  content: string;
  createdAt: string;
  userId?: string;
}

export interface MessageHistoryClient {
  getMessageVersionsRest(roomId: string, messageId: number): Promise<MessageVersionItem[]>;
}

export function MessageHistoryDialog({
  open,
  client,
  roomId,
  messageId,
  onClose,
}: {
  open: boolean;
  client: MessageHistoryClient | null;
  roomId: string;
  messageId: number | null;
  onClose: () => void;
}) {
  const [versions, setVersions] = React.useState<MessageVersionItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !client || messageId == null || !roomId) return;
    let active = true;
    setVersions(null);
    setError(null);
    client
      .getMessageVersionsRest(roomId, messageId)
      .then((rows) => {
        if (active) setVersions(rows);
      })
      .catch((err) => {
        if (active) setError(messageFromUnknown(err, "Failed to load edit history"));
      });
    return () => {
      active = false;
    };
  }, [open, client, roomId, messageId]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid="message-history-dialog">
        <DialogHeader>
          <DialogTitle>Edit history</DialogTitle>
          <DialogDescription>
            Every stored version of this message, oldest first.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!error && versions === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </p>
        ) : null}
        {versions && versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No previous versions.</p>
        ) : null}
        {versions && versions.length > 0 ? (
          <ol className="max-h-80 space-y-2 overflow-y-auto" data-testid="message-history-list">
            {versions.map((version, index) => (
              <li
                key={`${version.id}-${index}`}
                className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <span>
                    v{index + 1}
                    {index === versions.length - 1 ? " · current" : ""}
                  </span>
                  <span>{formatDateTime(version.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap break-words">
                  {version.content || "(empty)"}
                </p>
              </li>
            ))}
          </ol>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
