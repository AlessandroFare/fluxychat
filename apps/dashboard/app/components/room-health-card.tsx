"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { FluxyChatClient } from "@fluxy-chat/sdk";
import { Banner, Button, Section } from "./ui";
import { messageFromUnknown } from "@/lib/error-message";

interface RoomHealthCardProps {
  client: FluxyChatClient | null;
  roomId: string;
}

export function RoomHealthCard({ client, roomId }: RoomHealthCardProps) {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = roomId.trim();
    if (!client?.isAuthenticated() || !id) return;
    setLoading(true);
    setError(null);
    try {
      const body = await client.getRoomHealth(id);
      setHealth((body.health as Record<string, unknown>) ?? body);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load health"));
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, [client, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const score = Number((health as { score?: number })?.score ?? 0);
  const status = String((health as { status?: string })?.status ?? "");
  const metrics = (health as { metrics?: Record<string, number> })?.metrics ?? {};
  const live = (health as { live?: { online?: number } })?.live;
  const signals = ((health as { signals?: { level: string; detail: string }[] })?.signals ??
    []) as { level: string; detail: string }[];

  return (
    <Section
      title="Room health"
      description="Ops signal: message volume, moderation, webhook failures, live connections."
      actions={
        <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => void load()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      }
    >
      {error ? <Banner variant="error">{error}</Banner> : null}
      {health ? (
        <div className="grid gap-2 text-sm">
          <p>
            Score <strong>{score}</strong> · status <code>{status}</code>
            {live?.online != null ? (
              <>
                {" "}
                · <span>{live.online} live WS connection(s)</span>
              </>
            ) : null}
          </p>
          <ul className="text-xs text-muted-foreground">
            <li>Messages (1h): {metrics.messagesLastHour ?? 0}</li>
            <li>Messages (24h): {metrics.messagesLastDay ?? 0}</li>
            <li>Moderation events (24h): {metrics.moderationEvents24h ?? 0}</li>
            <li>Webhook failures (24h): {metrics.webhookFailures24h ?? 0}</li>
            <li>Members: {metrics.memberCount ?? 0}</li>
          </ul>
          {signals.length ? (
            <ul className="text-xs">
              {signals.map((s) => (
                <li key={s.detail}>
                  [{s.level}] {s.detail}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No warning signals.</p>
          )}
        </div>
      ) : null}
    </Section>
  );
}
