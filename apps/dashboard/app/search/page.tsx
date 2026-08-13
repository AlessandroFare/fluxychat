"use client";

import Link from "next/link";
import { SearchSnippet } from "./search-snippet";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { RoomPicker } from "../components/room-picker";
import { Banner, Button, EmptyState, Panel, SkeletonCard } from "../components/ui";
import { Badge } from "~/components/ui/badge";
import { RoomSentimentPanel } from "~/components/ui/room-sentiment-panel";
import { formatDateTime } from "@/lib/format-datetime";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";

type SearchMode = "keyword" | "hybrid" | "semantic";

export default function SearchPage() {
  const router = useRouter();
  const { memberJwt, adminJwt } = useDashboardSession();
  const token = memberJwt.trim() || adminJwt.trim();
  const [query, setQuery] = useState("");
  const [roomId, setRoomId] = useState("");
  const [mode, setMode] = useState<SearchMode>("hybrid");
  const [semanticAvailable, setSemanticAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<string>("keyword");
  const [results, setResults] = useState<
    Array<{
      id: number;
      roomId: string;
      userId: string;
      snippet: string;
      createdAt: string;
      score?: number;
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

  useEffect(() => {
    if (!client) return;
    void client.getSemanticSearchSettings().then((data) => {
      if (!data) return;
      setSemanticAvailable(data.settings.available);
      if (data.settings.defaultMode !== "keyword") {
        setMode(data.settings.defaultMode);
      }
    }).catch(() => setSemanticAvailable(false));
  }, [client]);

  async function runSearch() {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const effectiveMode =
        mode !== "keyword" && semanticAvailable === false ? "keyword" : mode;
      const data = await client.searchMessages(query, {
        roomId: roomId.trim() || undefined,
        limit: 30,
        mode: effectiveMode,
      });
      setResults(data?.results ?? []);
      setActiveMode(data?.mode ?? effectiveMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const semanticDisabled = semanticAvailable === false && mode !== "keyword";

  return (
    <ConsoleShell className="max-w-3xl">
      <ConsolePageHeader
        title="Search messages"
        description="Keyword FTS5 or hybrid semantic search across rooms you belong to."
      />

      {semanticAvailable === false ? (
        <Banner variant="warning" className="mb-4">
          Semantic search is off for this project.{" "}
          <Link href="/settings/search" className="font-medium underline underline-offset-2">
            Enable in settings
          </Link>{" "}
          or set <code className="text-xs">SEMANTIC_SEARCH_ENABLED=true</code> on the Worker.
        </Banner>
      ) : null}

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
                placeholder="Find a decision, link, or concept…"
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
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="max-w-md min-w-[12rem] flex-1">
                <RoomPicker
                  value={roomId}
                  onChange={setRoomId}
                  token={token}
                  placeholder="All rooms (optional filter)"
                />
              </div>
              <fieldset className="flex flex-wrap items-center gap-2 text-xs">
                <legend className="sr-only">Search mode</legend>
                {(["keyword", "hybrid", "semantic"] as const).map((m) => (
                  <label key={m} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1">
                    <input
                      type="radio"
                      name="search-mode"
                      checked={mode === m}
                      onChange={() => setMode(m)}
                    />
                    {m === "hybrid" ? (
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="size-3" /> Hybrid
                      </span>
                    ) : (
                      m
                    )}
                  </label>
                ))}
              </fieldset>
            </div>
            {semanticDisabled ? (
              <p className="mt-2 text-xs text-amber-700">Semantic modes unavailable. Using keyword search.</p>
            ) : null}
          </Panel>

          {roomId.trim() ? <RoomSentimentPanel client={client} roomId={roomId} /> : null}

          {error ? <Banner variant="error">{error}</Banner> : null}

          {loading ? (
            <div className="space-y-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              icon={Search}
              title={query.trim() ? `No matches for "${query.trim()}"` : "No results yet"}
              description={
                semanticAvailable && mode !== "keyword"
                  ? "Try hybrid mode for meaning-based matches, or keyword mode for exact terms."
                  : "Try a shorter query, or check your spelling. Keyword searches match whole words."
              }
            />
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                {results.length} result{results.length === 1 ? "" : "s"}
                {activeMode !== "keyword" ? (
                  <Badge variant="secondary" className="ml-2">
                    {activeMode}
                  </Badge>
                ) : null}
              </p>
              <ul className="space-y-2">
                {results.map((row) => (
                  <li key={row.id}>
                    <Panel className="p-4">
                      <SearchSnippet snippet={row.snippet} />
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {row.userId} · room{" "}
                        <Link href={`/rooms?room=${encodeURIComponent(row.roomId)}`} className="text-brand underline underline-offset-2">
                          {row.roomId}
                        </Link>{" "}
                        · {formatDateTime(row.createdAt)}
                        {typeof row.score === "number" ? (
                          <span className="ml-2 text-brand">score {(row.score * 100).toFixed(0)}%</span>
                        ) : null}
                      </p>
                    </Panel>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </ConsoleShell>
  );
}
