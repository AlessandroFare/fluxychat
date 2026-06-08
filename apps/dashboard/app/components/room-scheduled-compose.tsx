"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { FluxyChatClient } from "@fluxy-chat/sdk";
import { Banner, Button, Input, Section, Textarea } from "./ui";
import { messageFromUnknown } from "@/lib/error-message";
import { formatDateTime } from "@/lib/format-datetime";

interface RoomScheduledComposeProps {
  client: FluxyChatClient | null;
  roomId: string;
}

export function RoomScheduledCompose({ client, roomId }: RoomScheduledComposeProps) {
  const [content, setContent] = useState("");
  const [sendAt, setSendAt] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const id = roomId.trim();
    if (!client?.isAuthenticated() || !id) return;
    try {
      setRows(await client.listScheduledMessages(id));
    } catch {
      setRows([]);
    }
  }, [client, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function schedule() {
    const id = roomId.trim();
    if (!client?.isAuthenticated() || !id || !content.trim() || !sendAt) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await client.scheduleMessage(id, {
        content: content.trim(),
        sendAt: new Date(sendAt).toISOString(),
      });
      setContent("");
      setNotice("Message scheduled.");
      void load();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Schedule failed"));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(scheduleId: number) {
    const id = roomId.trim();
    if (!client?.isAuthenticated() || !id) return;
    try {
      await client.cancelScheduledMessage(id, scheduleId);
      void load();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Cancel failed"));
    }
  }

  return (
    <Section title="Scheduled messages" description="Queue a message for future delivery (Room DO alarm).">
      {error ? <Banner variant="error">{error}</Banner> : null}
      {notice ? <Banner variant="success">{notice}</Banner> : null}
      <div className="grid gap-2">
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} placeholder="Message to send later" />
        <Input type="datetime-local" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
        <Button type="button" variant="primary" disabled={busy || !content.trim() || !sendAt} onClick={() => void schedule()}>
          Schedule
        </Button>
      </div>
      {rows.length ? (
        <ul className="mt-3 space-y-2 text-xs">
          {rows.map((row) => {
            const id = Number(row.id);
            return (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-2 py-1.5">
                <span>
                  #{id} · {formatDateTime(String(row.send_at ?? ""))} —{" "}
                  {String(row.content ?? "").slice(0, 60)}
                </span>
                <Button type="button" variant="ghost" className="h-7 text-xs" onClick={() => void cancel(id)}>
                  Cancel
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No pending scheduled messages.</p>
      )}
    </Section>
  );
}
