"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { Section, Input, Button, Banner } from "./ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";

const WORKER_URL = getPublicWorkerUrl();

export interface UserWatchlistCardProps {
  jwt: string;
  userId: string;
}

export function UserWatchlistCard({ jwt, userId }: UserWatchlistCardProps) {
  const [targets, setTargets] = useState<
    Array<{ type: string; targetId: string; createdAt: string }>
  >([]);
  const [roomTarget, setRoomTarget] = useState("");
  const [userTarget, setUserTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const client = React.useMemo(() => {
    if (!jwt.trim() || !userId.trim()) return null;
    return new FluxyChatClient({
      baseUrl: WORKER_URL,
      userId: userId.trim(),
      token: jwt.trim(),
    });
  }, [jwt, userId]);

  const reload = useCallback(async () => {
    if (!client) return;
    setError(null);
    try {
      const res = await client.getWatchlist();
      setTargets(res.targets ?? []);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load watchlist"));
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function addTarget(type: "room" | "user", targetId: string) {
    if (!client || !targetId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await client.addWatchlistTarget({ type, targetId: targetId.trim() });
      if (type === "room") setRoomTarget("");
      else setUserTarget("");
      await reload();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Add failed"));
    } finally {
      setBusy(false);
    }
  }

  async function removeTarget(type: string, targetId: string) {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      await client.removeWatchlistTarget({
        type: type as "room" | "user",
        targetId,
      });
      await reload();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Remove failed"));
    } finally {
      setBusy(false);
    }
  }

  async function terminateConnections() {
    if (!client || !userId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await client.terminateUserConnections(userId.trim());
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Terminate failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="User watchlist & connections"
      description="Follow rooms/users (watchlist_event on user channel). Admin can terminate all WS connections for a user."
    >
      {error ? <Banner variant="error">{error}</Banner> : null}
      {!jwt ? (
        <p className="text-sm text-muted-foreground">JWT required.</p>
      ) : !userId.trim() ? (
        <p className="text-sm text-muted-foreground">
          Enter a User ID above (or use your JWT subject) to manage watchlist targets.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Input
              value={roomTarget}
              onChange={(e) => setRoomTarget(e.target.value)}
              placeholder="Follow room id"
              className="max-w-xs"
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy || !client}
              onClick={() => void addTarget("room", roomTarget)}
            >
              Follow room
            </Button>
            <Input
              value={userTarget}
              onChange={(e) => setUserTarget(e.target.value)}
              placeholder="Follow user id"
              className="max-w-xs"
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy || !client}
              onClick={() => void addTarget("user", userTarget)}
            >
              Follow user
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !client}
              onClick={() => void terminateConnections()}
            >
              Terminate connections
            </Button>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {targets.length === 0 ? (
              <li className="text-muted-foreground">No watchlist targets.</li>
            ) : (
              targets.map((t) => (
                <li key={`${t.type}:${t.targetId}`} className="flex items-center gap-2">
                  <span className="font-mono text-xs">
                    {t.type}:{t.targetId}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-6 px-2 text-xs"
                    disabled={busy}
                    onClick={() => void removeTarget(t.type, t.targetId)}
                  >
                    Remove
                  </Button>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </Section>
  );
}
