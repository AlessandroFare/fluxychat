"use client";

import React, { useState } from "react";
import { Search, Trash2, Users } from "lucide-react";
import { createTranscriptsApi } from "@fluxy-chat/sdk";
import type { TranscriptEntry } from "@fluxy-chat/sdk";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Button, Input, Panel } from "../components/ui";

export default function TranscriptsPage() {
  const [userKey, setUserKey] = useState("");
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<number | null>(null);

  const api = React.useMemo(() => createTranscriptsApi({ maxPerUser: 200 }), []);

  async function handleSearch() {
    if (!userKey.trim()) return;
    setLoading(true);
    setError(null);
    setDeleted(null);
    try {
      const [items, total] = await Promise.all([
        api.list({ userKey: userKey.trim(), limit: 50 }),
        api.count({ userKey: userKey.trim() }),
      ]);
      setEntries(items);
      setCount(total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load transcripts");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!userKey.trim()) return;
    if (!confirm(`Delete all transcripts for "${userKey.trim()}"?`)) return;
    setLoading(true);
    try {
      const result = await api.delete({ userKey: userKey.trim() });
      setDeleted(result.deleted);
      setEntries([]);
      setCount(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Conversation Transcripts"
        description="Per-user message persistence keyed by cross-platform identity. Append, list, filter, and delete with configurable retention."
      />

      <Panel className="mt-6 p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-foreground">User key (email or ID)</label>
            <Input
              value={userKey}
              onChange={(e) => setUserKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="user@example.com"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading || !userKey.trim()}>
            <Search className="mr-1.5 h-4 w-4" />
            Search
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading || !userKey.trim()}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </Panel>

      {error && (
        <Panel className="mt-4 border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </Panel>
      )}

      {deleted !== null && (
        <Panel className="mt-4 border-green-500/30 bg-green-500/10 p-3 text-sm text-green-400">
          Deleted {deleted} transcript entries for "{userKey}".
        </Panel>
      )}

      {count !== null && (
        <Panel className="mt-4 p-3 text-sm text-muted-foreground">
          <Users className="mr-1.5 inline h-4 w-4" />
          Total entries for <strong>{userKey}</strong>: {count}
        </Panel>
      )}

      <div className="mt-4 space-y-2">
        {entries.length === 0 && !loading && userKey && count === 0 && (
          <Panel className="p-6 text-center text-sm text-muted-foreground">
            No transcript entries found for this user key.
          </Panel>
        )}
        {entries.map((entry) => (
          <Panel key={entry.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`rounded px-1.5 py-0.5 font-medium ${
                    entry.role === "user" ? "bg-blue-500/10 text-blue-400" :
                    entry.role === "assistant" ? "bg-green-500/10 text-green-400" :
                    "bg-yellow-500/10 text-yellow-400"
                  }`}>
                    {entry.role}
                  </span>
                  <span>{entry.platform}</span>
                  <span>{entry.threadId}</span>
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <p className="mt-1.5 text-sm text-foreground">{entry.text}</p>
              </div>
              {entry.platformMessageId && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  #{entry.platformMessageId}
                </span>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </ConsoleShell>
  );
}
