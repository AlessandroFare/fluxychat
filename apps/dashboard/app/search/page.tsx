"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { RoomPicker } from "../components/room-picker";
import { Banner, Button, EmptyState, Panel, SkeletonCard } from "../components/ui";
import { formatDateTime } from "@/lib/format-datetime";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";

export default function SearchPage() {
  const router = useRouter();
  const { memberJwt, adminJwt } = useDashboardSession();
  const token = memberJwt.trim() || adminJwt.trim();
  const [query, setQuery] = useState("");
  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<
    Array<{
      id: number;
      roomId: string;
      userId: string;
      snippet: string;
      createdAt: string;
    }>
  >([]);

  const client = useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({
      baseUrl: getPublicWorkerUrl(),
      userId: "console",
      token,
    });
  }, [token]);

  async function runSearch() {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const data = await client.searchMessages(query, {
        roomId: roomId.trim() || undefined,
        limit: 30,
      });
      setResults(data?.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ConsoleShell className="max-w-3xl">
      <ConsolePageHeader
        title="Search messages"
        description="Full-text search across rooms you belong to (D1 FTS5). Filter by room optionally."
      />

      {!token ? (
        <EmptyState
          icon={Search}
          title="Connect a session"
          description="Mint a JWT in Quickstart, then search your project history."
          action={{
            label: "Open quickstart",
            onClick: () => router.push("/onboarding"),
          }}
        />
      ) : (
        <>
          <Panel className="mb-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="search"
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="Find a decision, link, or keyword…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
              />
              <Button type="button" onClick={() => void runSearch()} disabled={loading || !query.trim()}>
                Search
              </Button>
            </div>
            <div className="mt-3 max-w-md">
              <RoomPicker
                value={roomId}
                onChange={setRoomId}
                token={token}
                placeholder="All rooms (optional filter)"
              />
            </div>
          </Panel>

          {error ? <Banner variant="error">{error}</Banner> : null}

          {loading ? (
            <div className="space-y-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No results yet"
              description="Run a search to find messages across your rooms."
            />
          ) : (
            <ul className="space-y-2">
              {results.map((row) => (
                <li key={row.id}>
                  <Panel className="p-4">
                    <p
                      className="text-sm text-foreground"
                      dangerouslySetInnerHTML={{ __html: row.snippet.replace(/\[\[/g, "<mark>").replace(/\]\]/g, "</mark>") }}
                    />
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {row.userId} · room{" "}
                      <Link href={`/rooms?room=${encodeURIComponent(row.roomId)}`} className="text-brand hover:underline">
                        {row.roomId}
                      </Link>{" "}
                      · {formatDateTime(row.createdAt)}
                    </p>
                  </Panel>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </ConsoleShell>
  );
}
