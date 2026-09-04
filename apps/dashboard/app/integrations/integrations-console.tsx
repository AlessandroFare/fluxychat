"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  BookOpen, Database, Languages, Link2, Users,
  Search, Plus, Trash2, CheckCircle2, XCircle, RefreshCw,
  Globe, Activity, Clock, ArrowRightLeft,
} from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { IntegrationsStatusCard } from "../components/integrations-status-card";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import type { CrmProvider } from "@fluxy-chat/sdk";
import { createCrmIntegration as _createCrmIntegration } from "@fluxy-chat/sdk";
import { createKnowledgeBase } from "@fluxy-chat/sdk";
import { createResourceLinkManager } from "@fluxy-chat/sdk";
import { createTranslationService } from "@fluxy-chat/sdk";

/* -------------------------------------------------------------------------- */
/*  CRM Integration Demo                                                      */
/* -------------------------------------------------------------------------- */

function CrmDemo() {
  const crm = useMemo(() => _createCrmIntegration({
    provider: "salesforce" as CrmProvider, apiKey: "demo-key", instanceUrl: "https://demo.salesforce.com",
  }), []);
  const [provider, setProvider] = useState<CrmProvider>("salesforce");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketPriority, setTicketPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [syncDirection, setSyncDirection] = useState<"in" | "out" | "bidirectional">("bidirectional");
  const [log, setLog] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [tickets, setTickets] = useState<Array<{ id: string; subject: string; status: string }>>([]);

  function addLog(msg: string) { setLog((p) => [msg, ...p.slice(0, 19)]); }

  return (
    <Panel className="rounded-2xl p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-blue-500" /> CRM / Helpdesk</h3>
      <p className="mt-1 text-xs text-muted-foreground">Salesforce, Zendesk, HubSpot, Intercom: lookup contacts, create/update tickets with sync direction.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Config */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-muted-foreground">Provider</label>
          <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={provider} onChange={(e) => { setProvider(e.target.value as CrmProvider); crm.updateConfig({ provider: e.target.value as CrmProvider }); }}>
            {(["salesforce", "zendesk", "hubspot", "intercom"] as CrmProvider[]).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <Input placeholder="Contact name" className="flex-1" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <Input placeholder="Email" className="flex-1" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={async () => {
              if (!contactName.trim() || !contactEmail.trim()) { addLog("Fill name and email"); return; }
              const c = await crm.createContact({ name: contactName.trim(), email: contactEmail.trim() });
              setContacts((p) => [{ id: c.id, name: c.name, email: c.email }, ...p]);
              addLog(`Contact "${c.name}" created`);
            }}><Plus className="h-3 w-3 mr-1" /> Create contact</Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={async () => {
              const found = await crm.lookupContact({ email: contactEmail.trim() || undefined });
              addLog(found ? `Found: ${found.name} (${found.email})` : "Not found");
            }}><Search className="h-3 w-3 mr-1" /> Lookup</Button>
          </div>

          <div className="flex gap-2">
            <Input placeholder="Ticket subject" className="flex-2" value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} />
            <select className="rounded-md border border-border bg-background px-2 py-1 text-xs" value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value as any)}>
              {(["low", "medium", "high", "urgent"] as const).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <Button size="sm" className="w-full" variant="secondary" onClick={async () => {
            if (!ticketSubject.trim()) { addLog("Fill ticket subject"); return; }
            const lastContact = contacts[0];
            const t = await crm.createTicket({ subject: ticketSubject.trim(), description: "", status: "open", priority: ticketPriority, contactId: lastContact?.id });
            setTickets((p) => [{ id: t.id, subject: t.subject, status: t.status }, ...p]);
            addLog(`Ticket "${t.subject}" created`);
            setTicketSubject("");
          }}><Plus className="h-3 w-3 mr-1" /> Create ticket</Button>
        </div>

        {/* Sync & lists */}
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <select className="rounded-md border border-border bg-background px-2 py-2 text-xs" value={syncDirection} onChange={(e) => setSyncDirection(e.target.value as any)}>
              {(["in", "out", "bidirectional"] as const).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <Button size="sm" variant="outline" onClick={async () => {
              const r = await crm.sync(syncDirection);
              addLog(`Synced: ${r.contactsSynced} contacts, ${r.ticketsSynced} tickets${r.errors.length ? ` (${r.errors.length} errors)` : ""}`);
            }}><RefreshCw className="h-3 w-3 mr-1" /> Sync</Button>
          </div>

          {contacts.length > 0 && (
            <div className="rounded-md border border-border bg-muted/20 p-2 max-h-28 overflow-y-auto">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Contacts ({contacts.length})</p>
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-xs py-0.5">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">{c.email}</span>
                </div>
              ))}
            </div>
          )}

          {tickets.length > 0 && (
            <div className="rounded-md border border-border bg-muted/20 p-2 max-h-28 overflow-y-auto">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Tickets ({tickets.length})</p>
              {tickets.map((t) => (
                <div key={t.id} className="flex items-center gap-2 text-xs py-0.5">
                  <span className="font-medium truncate">{t.subject}</span>
                  <Badge variant="outline" className="text-[9px]">{t.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 max-h-28 space-y-0.5 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
        {log.length === 0 ? <p className="text-xs text-muted-foreground">Activity log will appear here</p> : log.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/*  Knowledge Base Demo                                                       */
/* -------------------------------------------------------------------------- */

function KnowledgeBaseDemo() {
  const kb = useMemo(() => createKnowledgeBase(), []);
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState<string>("confluence");
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sources, setSources] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [results, setResults] = useState<Array<{ title: string; score: number; snippet: string }>>([]);
  const [log, setLog] = useState<string[]>([]);

  function addLog(msg: string) { setLog((p) => [msg, ...p.slice(0, 19)]); }

  return (
    <Panel className="rounded-2xl p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="h-4 w-4 text-emerald-500" /> Knowledge Base</h3>
      <p className="mt-1 text-xs text-muted-foreground">Confluence, Notion, SharePoint, Google Drive: document ingest, chunking, semantic search, RAG context.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Source config */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Source name" className="flex-1" value={sourceName} onChange={(e) => setSourceName(e.target.value)} />
            <select className="rounded-md border border-border bg-background px-2 py-2 text-xs" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
              {(["confluence", "notion", "sharepoint", "google_drive"] as const).map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <Button size="sm" className="w-full" onClick={() => {
            if (!sourceName.trim()) { addLog("Enter source name"); return; }
            const s = kb.addSource({ type: sourceType as any, name: sourceName.trim(), connectionConfig: {}, enabled: true, syncIntervalMs: 3600000 });
            setSources((p) => [...p, { id: s.id, name: s.name, type: s.type }]);
            setSourceId(s.id);
            addLog(`Source "${s.name}" added (${s.type})`);
            setSourceName("");
          }}><Plus className="h-3 w-3 mr-1" /> Add source</Button>

          <Input placeholder="Document title" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} />
          <textarea className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none h-20" placeholder="Paste document content here..." value={docContent} onChange={(e) => setDocContent(e.target.value)} />
          <Button size="sm" className="w-full" variant="secondary" onClick={() => {
            const sid = sourceId || sources[0]?.id;
            if (!sid) { addLog("Add a source first"); return; }
            if (!docTitle.trim() || !docContent.trim()) { addLog("Fill title and content"); return; }
            const doc = kb.ingestDocument(sid, { title: docTitle.trim(), content: docContent.trim(), metadata: {} });
            addLog(`Ingested "${doc.title}" → ${doc.chunks.length} chunks`);
            setDocTitle(""); setDocContent("");
          }}><Plus className="h-3 w-3 mr-1" /> Ingest document</Button>
        </div>

        {/* Search */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Search knowledge base..." className="flex-1" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") {
                if (!searchQuery.trim()) return;
                const res = kb.search({ text: searchQuery.trim(), maxResults: 5 });
                setResults(res.map((r) => ({ title: r.document.title, score: r.score, snippet: r.chunk.content.slice(0, 80) })));
                addLog(`Search "${searchQuery}" → ${res.length} results`);
              }}} />
            <Button size="sm" variant="outline" onClick={() => {
              if (!searchQuery.trim()) return;
              const res = kb.search({ text: searchQuery.trim(), maxResults: 5 });
              setResults(res.map((r) => ({ title: r.document.title, score: r.score, snippet: r.chunk.content.slice(0, 80) })));
              addLog(`Search "${searchQuery}" → ${res.length} results`);
            }}><Search className="h-3 w-3" /></Button>
          </div>

          {sources.length > 0 && (
            <div className="rounded-md border border-border bg-muted/20 p-2 max-h-20 overflow-y-auto">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Sources ({sources.length})</p>
              {sources.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs py-0.5">
                  <span>{s.name} <span className="text-muted-foreground">({s.type})</span></span>
                  <button className="text-red-400 hover:text-red-600" onClick={() => { kb.removeSource(s.id); setSources((p) => p.filter((x) => x.id !== s.id)); addLog(`Removed source "${s.name}"`); }}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className="rounded-md border border-border bg-muted/20 p-2 max-h-32 overflow-y-auto">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Results</p>
              {results.map((r, i) => (
                <div key={i} className="py-1.5 border-b border-border/40 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{r.title}</span>
                    <Badge variant="outline" className="text-[9px]">{(r.score * 100).toFixed(0)}%</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{r.snippet}...</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 max-h-28 space-y-0.5 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
        {log.length === 0 ? <p className="text-xs text-muted-foreground">Activity log will appear here</p> : log.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/*  Resource Links Demo                                                       */
/* -------------------------------------------------------------------------- */

function ResourceLinksDemo() {
  const rlm = useMemo(() => createResourceLinkManager(), []);
  const [linkUri, setLinkUri] = useState("");
  const [linkName, setLinkName] = useState("");
  const [links, setLinks] = useState<Array<{ uri: string; name: string; valid: boolean }>>([]);
  const [cache, setCache] = useState<Array<{ uri: string }>>([]);
  const [log, setLog] = useState<string[]>([]);

  function addLog(msg: string) { setLog((p) => [msg, ...p.slice(0, 19)]); }

  return (
    <Panel className="rounded-2xl p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4 text-purple-500" /> Resource Links</h3>
      <p className="mt-1 text-xs text-muted-foreground">URI validation with policy (allowed schemes, blocked domains), lazy fetch with caching.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="https://..." className="flex-1 font-mono text-xs" value={linkUri} onChange={(e) => setLinkUri(e.target.value)} />
            <Input placeholder="Link name" className="flex-1" value={linkName} onChange={(e) => setLinkName(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => {
              if (!linkUri.trim()) { addLog("Enter a URI"); return; }
              const valid = rlm.validateUri(linkUri.trim());
              setLinks((p) => [...p, { uri: linkUri.trim(), name: linkName || linkUri.trim(), valid }]);
              addLog(valid ? `URI "${linkUri}" is valid ✓` : `URI "${linkUri}" blocked by policy ✗`);
            }}><Plus className="h-3 w-3 mr-1" /> Add link</Button>
            <Button size="sm" variant="outline" onClick={async () => {
              if (!linkUri.trim()) return;
              try {
                const result = await rlm.fetchResource(linkUri.trim());
                setCache((p) => [...p, { uri: linkUri.trim() }]);
                addLog(`Fetched: ${result.content.slice(0, 40)}...`);
              } catch (e: any) { addLog(`Error: ${e.message}`); }
            }}><RefreshCw className="h-3 w-3 mr-1" /> Fetch</Button>
          </div>
        </div>

        <div className="space-y-3">
          {links.length > 0 && (
            <div className="rounded-md border border-border bg-muted/20 p-2 max-h-32 overflow-y-auto">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Links ({links.length})</p>
              {links.map((l, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                  {l.valid ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                  <span className="truncate font-mono">{l.uri}</span>
                  <span className="text-muted-foreground shrink-0">{l.name}</span>
                  <button onClick={() => { setLinks((p) => p.filter((_, j) => j !== i)); addLog("Link removed"); }}>
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {cache.length > 0 && (
            <div className="rounded-md border border-border bg-muted/20 p-2 max-h-20 overflow-y-auto">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Cache ({cache.length})</p>
              {cache.map((c, i) => (
                <p key={i} className="text-xs font-mono text-muted-foreground truncate py-0.5">{c.uri}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 max-h-28 space-y-0.5 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
        {log.length === 0 ? <p className="text-xs text-muted-foreground">Activity log will appear here</p> : log.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/*  Translation Demo                                                          */
/* -------------------------------------------------------------------------- */

function TranslationDemo() {
  const ts = useMemo(() => createTranslationService(), []);
  const [text, setText] = useState("");
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("it");
  const [glossarySource, setGlossarySource] = useState("");
  const [glossaryTarget, setGlossaryTarget] = useState("");
  const [result, setResult] = useState<{ original: string; translated: string; confidence: number } | null>(null);
  const [glossary, setGlossary] = useState<Array<{ source: string; target: string }>>([]);
  const [detected, setDetected] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  function addLog(msg: string) { setLog((p) => [msg, ...p.slice(0, 19)]); }

  const LANGUAGES = { en: "English", it: "Italian", fr: "French", de: "German", es: "Spanish", zh: "Chinese", ja: "Japanese", ar: "Arabic", ru: "Russian" };

  return (
    <Panel className="rounded-2xl p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Languages className="h-4 w-4 text-amber-500" /> Real-time Translation</h3>
      <p className="mt-1 text-xs text-muted-foreground">Per-user language preference, glossary terms, auto-detect, live translate with original access.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex gap-2">
            <select className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" value={sourceLang} onChange={(e) => setSourceLang(e.target.value)}>
              {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <ArrowRightLeft className="h-5 w-5 self-center text-muted-foreground" />
            <select className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
              {Object.entries(LANGUAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <textarea className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none h-20" placeholder="Type text to translate..." value={text} onChange={(e) => setText(e.target.value)} />

          <div className="flex gap-2">
            <Button size="sm" onClick={() => {
              if (!text.trim()) return;
              const r = ts.translate(text.trim(), sourceLang, targetLang);
              setResult({ original: r.originalText, translated: r.translatedText, confidence: r.confidence });
              addLog(`Translated: ${sourceLang} → ${targetLang} (${(r.confidence * 100).toFixed(0)}%)`);
            }}><Globe className="h-3 w-3 mr-1" /> Translate</Button>
            <Button size="sm" variant="outline" onClick={() => {
              const lang = ts.detectLanguage(text.trim() || "你好世界");
              setDetected(lang);
              addLog(`Detected: ${LANGUAGES[lang as keyof typeof LANGUAGES] || lang}`);
            }}><Activity className="h-3 w-3 mr-1" /> Detect language</Button>
          </div>

          {detected && (
            <p className="text-xs text-muted-foreground">Detected: <strong>{LANGUAGES[detected as keyof typeof LANGUAGES] || detected}</strong></p>
          )}

          {result && (
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-muted-foreground">Translation</span>
                <Badge variant="outline" className="text-[9px]">{(result.confidence * 100).toFixed(0)}% confidence</Badge>
              </div>
              <p className="text-xs text-muted-foreground line-through">{result.original}</p>
              <p className="text-sm font-medium mt-1">{result.translated}</p>
            </div>
          )}
        </div>

        {/* Glossary */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Source term" className="flex-1" value={glossarySource} onChange={(e) => setGlossarySource(e.target.value)} />
            <Input placeholder="Target term" className="flex-1" value={glossaryTarget} onChange={(e) => setGlossaryTarget(e.target.value)} />
          </div>
          <Button size="sm" className="w-full" variant="secondary" onClick={() => {
            if (!glossarySource.trim() || !glossaryTarget.trim()) return;
            setGlossary((p) => [...p, { source: glossarySource.trim(), target: glossaryTarget.trim() }]);
            addLog(`Glossary: "${glossarySource}" → "${glossaryTarget}"`);
            setGlossarySource(""); setGlossaryTarget("");
          }}><Plus className="h-3 w-3 mr-1" /> Add glossary term</Button>

          {glossary.length > 0 && (
            <div className="rounded-md border border-border bg-muted/20 p-2 max-h-32 overflow-y-auto">
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Glossary ({glossary.length})</p>
              {glossary.map((g, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                  <span>{g.source} <ArrowRightLeft className="h-3 w-3 inline text-muted-foreground" /> {g.target}</span>
                  <button onClick={() => { setGlossary((p) => p.filter((_, j) => j !== i)); addLog(`Removed "${g.source}"`); }}>
                    <Trash2 className="h-3 w-3 text-red-400 hover:text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 max-h-28 space-y-0.5 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
        {log.length === 0 ? <p className="text-xs text-muted-foreground">Activity log will appear here</p> : log.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export function IntegrationsConsolePage() {
  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Integrations"
        description="Turnstile, SMS, CRM, knowledge bases, translation, and resource links. Live SDK-powered demos from @fluxy-chat/sdk."
      />

      <IntegrationsStatusCard />

      <h2 className="mt-10 text-sm font-semibold">SDK Integration Modules (Interactive)</h2>
      <p className="text-xs text-muted-foreground">Each module runs in-memory using the real SDK factory. Try creating contacts, searching docs, validating links, and translating text.</p>

      <div className="mt-4 space-y-6">
        <CrmDemo />
        <KnowledgeBaseDemo />
        <div className="grid gap-6 md:grid-cols-2">
          <ResourceLinksDemo />
          <TranslationDemo />
        </div>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Full checklists:{" "}
        <Link href="/guides/offline-notify-in-app-plus-sms" className="text-brand underline underline-offset-2">
          in-app + SMS guide
        </Link>
        {" · "}
        <a
          href="https://github.com/AlessandroFare/fluxychat/blob/main/docs/operations/production-demo-and-sms.md"
          className="text-brand underline underline-offset-2"
          target="_blank"
          rel="noopener noreferrer"
        >
          Production checklist (docs)
        </a>
      </p>
    </ConsoleShell>
  );
}
