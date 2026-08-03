"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { RoomPicker } from "../../components/room-picker";
import { Banner, Button, EmptyState, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  backfillMessageEmbeddings,
  getSemanticSearchSettings,
  updateSemanticSearchSettings,
  type SemanticSearchSettings,
} from "@/lib/semantic-search-client";

export default function SemanticSearchSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settings, setSettings] = useState<SemanticSearchSettings | null>(null);
  const [backfillRoomId, setBackfillRoomId] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getSemanticSearchSettings(token);
      setSettings(data.settings);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load search settings"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(patch: Partial<Pick<SemanticSearchSettings, "enabled" | "autoEmbed" | "defaultMode">>) {
    if (!token || !settings) return;
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      const data = await updateSemanticSearchSettings(token, patch);
      setSettings(data.settings);
      setNotice("Search settings saved.");
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save settings"));
    } finally {
      setBusy(null);
    }
  }

  async function runBackfill() {
    if (!token) return;
    setBusy("backfill");
    setError(null);
    setNotice(null);
    try {
      const result = await backfillMessageEmbeddings(token, {
        roomId: backfillRoomId.trim() || undefined,
        limit: 500,
      });
      setNotice(
        `Backfill complete: ${result.stored} stored, ${result.skipped} skipped (${result.embeddingCount} total embeddings).`,
      );
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Backfill failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell className="max-w-2xl">
      <ConsolePageHeader
        title="Semantic search"
        description="Hybrid FTS + vector search over message history. Enable per project, control auto-embedding, and reindex existing messages."
      />

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <EmptyState
          icon={Search}
          title="Admin JWT required"
          description="Mint an admin token in Quickstart to configure semantic search."
          action={{ label: "Open quickstart", onClick: () => { window.location.href = "/onboarding"; } }}
        />
      ) : loading ? (
        <Panel className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </Panel>
      ) : settings ? (
        <>
          {!settings.globalEnabled ? (
            <Banner variant="warning" className="mb-4">
              Worker flag <code className="text-xs">SEMANTIC_SEARCH_ENABLED</code> is off. Set it in Worker
              secrets / <code className="text-xs">.dev.vars</code> to enable embeddings globally.
            </Banner>
          ) : null}

          <Section title="Project toggle" className="mb-4">
            <Panel className="space-y-4 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={settings.enabled}
                  disabled={!settings.globalEnabled || busy === "save"}
                  onChange={(e) => void save({ enabled: e.target.checked })}
                />
                <span>
                  <span className="font-medium text-foreground">Semantic search enabled</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    When off, search falls back to keyword FTS5 only.
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={settings.autoEmbed}
                  disabled={!settings.available || busy === "save"}
                  onChange={(e) => void save({ autoEmbed: e.target.checked })}
                />
                <span>
                  <span className="font-medium text-foreground">Auto-embed new messages</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Generates vectors on post (messages ≥10 chars). Uses your configured embedding provider.
                  </span>
                </span>
              </label>

              <div>
                <label className="text-sm font-medium text-foreground" htmlFor="default-mode">
                  Default search mode
                </label>
                <select
                  id="default-mode"
                  className="mt-1.5 w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={settings.defaultMode}
                  disabled={!settings.available || busy === "save"}
                  onChange={(e) =>
                    void save({
                      defaultMode: e.target.value as SemanticSearchSettings["defaultMode"],
                    })
                  }
                >
                  <option value="hybrid">Hybrid (recommended)</option>
                  <option value="semantic">Semantic only</option>
                  <option value="keyword">Keyword only</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">
                  <Sparkles className="mr-1 inline size-3" />
                  {settings.embeddingCount.toLocaleString()} embeddings indexed
                </Badge>
                {settings.updatedAt ? (
                  <span>Updated {formatDateTime(settings.updatedAt)}</span>
                ) : null}
                {settings.available ? (
                  <Badge variant="outline" className="text-emerald-700">Active</Badge>
                ) : (
                  <Badge variant="outline">Inactive</Badge>
                )}
              </div>
            </Panel>
          </Section>

          <Section title="Reindex embeddings" className="mb-4">
            <Panel className="space-y-3 p-4">
              <p className="text-sm text-muted-foreground">
                Backfill vectors for messages that pre-date auto-embed or were missed. Processes up to 500
                messages per run (newest first).
              </p>
              <div className="max-w-md">
                <RoomPicker
                  value={backfillRoomId}
                  onChange={setBackfillRoomId}
                  token={token}
                  placeholder="All rooms (optional)"
                />
              </div>
              <Button
                type="button"
                disabled={!settings.available || busy === "backfill"}
                onClick={() => void runBackfill()}
              >
                {busy === "backfill" ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Running backfill…
                  </>
                ) : (
                  "Run backfill"
                )}
              </Button>
            </Panel>
          </Section>

          <p className="text-xs text-muted-foreground">
            Try search in{" "}
            <Link href="/search" className="text-brand underline underline-offset-2">
              Search console
            </Link>{" "}
            or from any room chat panel.
          </p>
        </>
      ) : null}
    </ConsoleShell>
  );
}
