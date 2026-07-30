"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Loader2, Plus, RefreshCw } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { RoomPicker } from "../../components/room-picker";
import { Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createCrmTicket,
  handoffCrmToAgent,
  listCrmConnections,
  listCrmSyncHistory,
  lookupCrmContact,
  syncCrmConnection,
  upsertCrmConnection,
  type CrmConnection,
  type CrmProvider,
  type CrmSyncResult,
} from "@/lib/crm-client";

const PROVIDERS: CrmProvider[] = ["salesforce", "zendesk", "hubspot", "intercom"];

export default function CrmSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [connections, setConnections] = useState<CrmConnection[]>([]);
  const [history, setHistory] = useState<CrmSyncResult[]>([]);

  const [provider, setProvider] = useState<CrmProvider>("zendesk");
  const [apiKey, setApiKey] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");

  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<string | null>(null);

  const [ticketSubject, setTicketSubject] = useState("");
  const [handoffRoom, setHandoffRoom] = useState("");
  const [handoffAgent, setHandoffAgent] = useState("");
  const [lastTicketId, setLastTicketId] = useState("");

  const loadAll = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [conn, hist] = await Promise.all([
        listCrmConnections(token),
        listCrmSyncHistory(token),
      ]);
      setConnections(conn.connections ?? []);
      setHistory(hist.history ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load CRM settings"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleSaveConnection() {
    if (!token) return;
    setBusy("save");
    try {
      await upsertCrmConnection(token, {
        provider,
        apiKey: apiKey || undefined,
        instanceUrl: instanceUrl || undefined,
        enabled: true,
      });
      setNotice(`${provider} connection saved.`);
      setApiKey("");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Save failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleSync(p: CrmProvider) {
    if (!token) return;
    setBusy(`sync-${p}`);
    try {
      const result = await syncCrmConnection(token, p, "bidirectional");
      setNotice(`Synced ${p}: ${result.contactsSynced} contacts, ${result.ticketsSynced} tickets.`);
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Sync failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleLookup() {
    if (!token || !lookupEmail.trim()) return;
    setBusy("lookup");
    setLookupResult(null);
    try {
      const res = await lookupCrmContact(token, provider, lookupEmail.trim());
      setLookupResult(res.contact ? JSON.stringify(res.contact) : "Not found — run sync first.");
    } catch (err) {
      setError(messageFromUnknown(err, "Lookup failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateTicket() {
    if (!token || !ticketSubject.trim()) return;
    setBusy("ticket");
    try {
      const res = await createCrmTicket(token, {
        provider,
        subject: ticketSubject.trim(),
        contactEmail: lookupEmail || undefined,
        priority: "medium",
      });
      const id = String(res.ticket.id ?? "");
      setLastTicketId(id);
      setNotice(`Ticket created: ${id}`);
      setTicketSubject("");
    } catch (err) {
      setError(messageFromUnknown(err, "Ticket creation failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleHandoff() {
    if (!token || !lastTicketId || !handoffRoom.trim() || !handoffAgent.trim()) return;
    setBusy("handoff");
    try {
      await handoffCrmToAgent(token, {
        provider,
        ticketId: lastTicketId,
        roomId: handoffRoom.trim(),
        agentId: handoffAgent.trim(),
      });
      setNotice("Handoff queued to agent.");
    } catch (err) {
      setError(messageFromUnknown(err, "Handoff failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="CRM &amp; helpdesk"
        description="Connect Salesforce, Zendesk, HubSpot, or Intercom — sync contacts, tickets, and agent handoff."
      />
      <ConsoleFeedback error={error} notice={notice} />

      {!token && (
        <Panel className="p-4 text-sm text-muted-foreground">
          Admin JWT required — copy one from <Link href="/projects" className="text-primary underline">Projects</Link>.
        </Panel>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          <Section title="Connections">
            <Panel className="p-4 space-y-3 max-w-xl">
              <select className="rounded-md border border-border bg-background px-2 py-1.5 text-sm w-full" value={provider} onChange={(e) => setProvider(e.target.value as CrmProvider)}>
                {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <Input type="password" placeholder="API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <Input placeholder="Instance URL (optional)" value={instanceUrl} onChange={(e) => setInstanceUrl(e.target.value)} />
              <Button size="sm" disabled={!token || busy === "save"} onClick={() => void handleSaveConnection()}>
                <Plus className="h-3 w-3 mr-1" /> Save connection
              </Button>
            </Panel>
            {connections.length > 0 && (
              <Panel className="p-4 mt-3 space-y-2">
                {connections.map((c) => (
                  <div key={c.provider} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{c.provider}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.enabled ? "default" : "secondary"}>{c.enabled ? "enabled" : "disabled"}</Badge>
                      {c.lastSyncAt && <span className="text-xs text-muted-foreground">{formatDateTime(c.lastSyncAt)}</span>}
                      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void handleSync(c.provider)}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </Panel>
            )}
          </Section>

          <Section title="Contact lookup &amp; tickets">
            <Panel className="p-4 space-y-3 max-w-xl">
              <div className="flex gap-2">
                <Input placeholder="Contact email" value={lookupEmail} onChange={(e) => setLookupEmail(e.target.value)} />
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void handleLookup()}>Lookup</Button>
              </div>
              {lookupResult && <p className="text-xs font-mono text-muted-foreground">{lookupResult}</p>}
              <Input placeholder="Ticket subject" value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} />
              <Button size="sm" disabled={!!busy} onClick={() => void handleCreateTicket()}>Create ticket</Button>
            </Panel>
          </Section>

          <Section title="Agent handoff">
            <Panel className="p-4 space-y-3 max-w-xl">
              <p className="text-xs text-muted-foreground">Ticket: {lastTicketId || "create a ticket first"}</p>
              <RoomPicker token={token} value={handoffRoom} onChange={setHandoffRoom} />
              <Input placeholder="Agent ID" value={handoffAgent} onChange={(e) => setHandoffAgent(e.target.value)} />
              <Button size="sm" disabled={!token || !lastTicketId || !!busy} onClick={() => void handleHandoff()}>
                <ArrowRightLeft className="h-3 w-3 mr-1" /> Handoff to agent
              </Button>
            </Panel>
          </Section>

          {history.length > 0 && (
            <Section title="Sync history">
              <Panel className="p-4 space-y-1 max-h-48 overflow-y-auto text-xs">
                {history.map((h, i) => (
                  <p key={i}>{h.provider} · {h.contactsSynced}c / {h.ticketsSynced}t · {formatDateTime(h.syncedAt)}</p>
                ))}
              </Panel>
            </Section>
          )}
        </div>
      )}
    </ConsoleShell>
  );
}
