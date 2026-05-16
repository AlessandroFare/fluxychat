"use client";

import React, { useState } from "react";
import { useDashboardSession } from "../components/dashboard-session";
import { RoomPicker } from "../components/room-picker";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Banner, Button, Input, Section } from "../components/ui";
import { formatDateTime } from "@/lib/format-datetime";
import {
  consoleDarkCardClass,
  consoleDarkCardMutedClass,
  consoleDarkCodeClass,
} from "@/lib/console-dark-surface";
import { messageFromUnknown } from "@/lib/error-message";

interface MessageResult {
  id: number;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

function normalizeMessage(row: Record<string, unknown>): MessageResult | null {
  const id = Number(row.id);
  const content = String(row.content ?? "");
  if (!Number.isFinite(id) || !content) return null;
  return {
    id,
    room_id: String(row.room_id ?? row.roomId ?? ""),
    user_id: String(row.user_id ?? row.userId ?? ""),
    content,
    created_at: String(row.created_at ?? row.createdAt ?? ""),
  };
}

export default function SearchPage() {
  const { adminJwt, memberJwt, activeProject, authHeader } = useDashboardSession();
  const readToken = memberJwt.trim() || adminJwt.trim();
  const [roomId, setRoomId] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MessageResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const runSearch = async () => {
    if (!readToken) {
      setError("Select a session first from Projects or Onboarding.");
      return;
    }
    if (!query.trim()) {
      setError("Enter a keyword to search.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const params = new URLSearchParams();
      params.set("q", query.trim());
      if (roomId.trim()) params.set("roomId", roomId.trim());

      const headers = authHeader(readToken);
      if (!headers) {
        setError("Missing authorization header.");
        return;
      }

      const res = await fetch(`/api/fluxy/search-messages?${params.toString()}`, {
        headers,
        credentials: "same-origin",
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          res.status === 401 || res.status === 307
            ? "Search API blocked (auth). Refresh the page and sign in again."
            : `Search API returned HTML instead of JSON (${res.status}).`,
        );
      }
      const json = (await res.json()) as { messages?: Record<string, unknown>[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error || `Search failed (${res.status})`);
      }
      const rows = (json.messages || [])
        .map((row) => normalizeMessage(row))
        .filter((row): row is MessageResult => row !== null);
      setResults(rows);
      setNotice(
        rows.length
          ? `Found ${rows.length} message(s) containing “${query.trim()}”.`
          : `No messages matched “${query.trim()}”. Try a shorter keyword or leave room empty (admin JWT searches the whole project).`,
      );
    } catch (err: unknown) {
      const message = messageFromUnknown(err, "Unknown error");
      if (message.includes("Unexpected token") && message.includes("<!DOCTYPE")) {
        setError("Search API returned a web page instead of JSON. Reload the app — if it persists, sign in again.");
      } else if (message === "Failed to fetch") {
        setError("Could not reach the search API. Check that the dev server and Worker are running.");
      } else {
        setError(message);
      }
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConsoleShell className="max-w-4xl lg:max-w-4xl">
      <ConsolePageHeader
        title="Message search"
        description={
          <>
            Partial text match across messages in your project (
            <code className="text-xs">LIKE %keyword%</code>). Project:{" "}
            <code>{activeProject?.name || "none selected"}</code>
          </>
        }
      />

      {error ? <Banner variant="error">Error: {error}</Banner> : null}
      {notice ? <Banner variant="success">{notice}</Banner> : null}
      {!readToken ? (
        <Banner variant="info">
          Search requires a JWT. Mint a member JWT in <code>/onboarding</code> or set an admin JWT in{" "}
          <code>/projects</code>.
        </Banner>
      ) : null}

      <Section
        title="Search"
        description="Substring search on message body. hello matches Hello world. Optional room id narrows the scope."
        actions={
          <Button variant="primary" onClick={() => void runSearch()} disabled={loading || !query.trim() || !readToken}>
            {loading ? "Searching..." : "Search"}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <RoomPicker
            token={readToken}
            value={roomId}
            onChange={setRoomId}
            allowEmpty
            emptyLabel="All rooms (project scope)"
            placeholder="Room ID"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Keyword (e.g. hello)"
            onKeyDown={(e) => {
              if (e.key === "Enter") void runSearch();
            }}
          />
        </div>
      </Section>

      <Section title="Results">
        <div className="flex flex-col gap-3">
          {results.map((msg) => (
            <div key={`${msg.id}-${msg.created_at}`} className={consoleDarkCardClass}>
              <div className={`mb-1.5 ${consoleDarkCardMutedClass}`}>
                Room: <code className={consoleDarkCodeClass}>{msg.room_id}</code> · User:{" "}
                <code className={consoleDarkCodeClass}>{msg.user_id}</code> ·{" "}
                {msg.created_at ? formatDateTime(msg.created_at) : "—"}
              </div>
              <div className="text-sm text-slate-100">{msg.content}</div>
            </div>
          ))}
          {!loading && results.length === 0 ? (
            <p className="text-muted-foreground">No results yet.</p>
          ) : null}
        </div>
      </Section>
    </ConsoleShell>
  );
}
