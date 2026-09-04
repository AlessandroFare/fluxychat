"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Loader2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleFeedback } from "../components/console-feedback";
import { Button, Input, Panel, Section, Textarea } from "../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createKbSource,
  deleteKbSource,
  listKbSources,
  searchKb,
  syncKbSource,
  type KbSource,
  type KbSourceType,
  type KbSearchHit,
} from "@/lib/kb-client";

const SOURCE_TYPES: { value: KbSourceType; label: string }[] = [
  { value: "url", label: "URL / web page" },
  { value: "file", label: "Manual paste" },
  { value: "notion", label: "Notion" },
  { value: "confluence", label: "Confluence" },
  { value: "google_drive", label: "Google Drive" },
  { value: "intercom", label: "Intercom" },
  { value: "zendesk", label: "Zendesk" },
];

export default function KnowledgePage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [sources, setSources] = useState<KbSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<KbSourceType>("url");
  const [newUrl, setNewUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const [syncSourceId, setSyncSourceId] = useState<string | null>(null);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");

  const [searchQ, setSearchQ] = useState("");
  const [hits, setHits] = useState<KbSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const loadSources = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await listKbSources(token);
      setSources(res.sources ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load KB sources"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  async function handleCreate() {
    if (!token || !newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const config: Record<string, string> = {};
      if (newType === "url" && newUrl.trim()) config.url = newUrl.trim();
      await createKbSource(token, { type: newType, name: newName.trim(), config });
      setNewName("");
      setNewUrl("");
      setNotice("Source created.");
      await loadSources();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create source"));
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token || !confirm("Delete this source? Indexed documents remain in D1 until purged.")) return;
    try {
      await deleteKbSource(token, id);
      setNotice("Source removed.");
      await loadSources();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to delete source"));
    }
  }

  async function handleSync(source: KbSource) {
    if (!token) return;
    setSyncSourceId(source.id);
    setError(null);
    try {
      if (source.type === "url") {
        await syncKbSource(token, source.id, { url: source.config?.url });
      } else {
        if (!pasteContent.trim()) {
          setError("Paste content below before syncing manual sources.");
          return;
        }
        await syncKbSource(token, source.id, {
          title: pasteTitle.trim() || source.name,
          content: pasteContent,
        });
        setPasteContent("");
        setPasteTitle("");
      }
      setNotice(`Synced ${source.name}.`);
    } catch (err) {
      setError(messageFromUnknown(err, "Sync failed"));
    } finally {
      setSyncSourceId(null);
    }
  }

  async function handleSearch() {
    if (!token || !searchQ.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await searchKb(token, searchQ.trim());
      setHits(res.hits ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Search failed"));
    } finally {
      setSearching(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Knowledge base"
        description="Connect URL or manual sources, ingest documents, and search for RAG agent context."
      />

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">
          Admin JWT required. Open{" "}
          <Link href="/projects" className="font-medium underline-offset-2 hover:underline">
            Projects
          </Link>{" "}
          first.
        </Panel>
      ) : (
        <div className="space-y-8">
          <Section title="Add connector">
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="Source name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                value={newType}
                onChange={(e) => setNewType(e.target.value as KbSourceType)}
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {newType === "url" ? (
                <Input placeholder="https://docs.example.com/page" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              ) : (
                <span className="flex items-center text-xs text-muted-foreground">OAuth sync: paste content on sync</span>
              )}
            </div>
            <Button className="mt-3" size="sm" disabled={creating} onClick={() => void handleCreate()}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add source
            </Button>
          </Section>

          <Section title="Sources">
            {loading ? (
              <p className="text-sm text-muted-foreground">
                <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
              </p>
            ) : sources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sources yet. Start with a URL connector.</p>
            ) : (
              <ul className="divide-y rounded-lg bg-white/90 shadow-[var(--shadow-2)]">
                {sources.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="mr-2">{s.type}</Badge>
                        {s.config?.url ? s.config.url : s.id}
                        {s.lastSyncedAt ? ` · synced ${s.lastSyncedAt}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={syncSourceId === s.id}
                        onClick={() => void handleSync(s)}
                      >
                        {syncSourceId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="mr-1 h-3 w-3" /> Sync
                          </>
                        )}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-700" onClick={() => void handleDelete(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Manual ingest (non-URL sources)">
            <Input className="mb-2" placeholder="Document title" value={pasteTitle} onChange={(e) => setPasteTitle(e.target.value)} />
            <Textarea
              rows={5}
              placeholder="Paste Markdown or plain text, then click Sync on the source row."
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
            />
          </Section>

          <Section title="Search index">
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-md"
                placeholder="Ask or keyword search…"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
              />
              <Button size="sm" disabled={searching} onClick={() => void handleSearch()}>
                {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Search
              </Button>
            </div>
            {hits.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {hits.map((h) => (
                  <li key={h.id} className="rounded-lg bg-white/80 shadow-[var(--shadow-2)] p-3 text-sm">
                    <p className="font-medium">{h.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{h.excerpt}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <p className="text-xs text-muted-foreground">
            <BookOpen className="mr-1 inline h-3 w-3" />
            Wire RAG into agents via{" "}
            <Link href="/docs/cookbook/kb-rag-agent" className="font-medium underline-offset-2 hover:underline">
              KB + RAG cookbook
            </Link>{" "}
            and <code className="text-[11px]">POST /admin/kb/rag</code>.
          </p>
        </div>
      )}
    </ConsoleShell>
  );
}
