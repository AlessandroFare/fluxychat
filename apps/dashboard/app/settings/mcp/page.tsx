"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Wrench } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Input, Panel, Section, Textarea } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  getMcpIdentityRegistry,
  listMcpToolAudit,
  registerMcpServer,
  registerMcpToolProvenance,
  type McpIdentityRegistry,
  type McpToolAuditEntry,
} from "@/lib/mcp-identity-client";

export default function McpIdentitySettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [registry, setRegistry] = useState<McpIdentityRegistry | null>(null);
  const [audit, setAudit] = useState<McpToolAuditEntry[]>([]);
  const [builtinInfo, setBuiltinInfo] = useState<Record<string, unknown> | null>(null);

  const [serverName, setServerName] = useState("");
  const [serverVersion, setServerVersion] = useState("1.0.0");
  const [serverVendor, setServerVendor] = useState("custom");
  const [serverInstructions, setServerInstructions] = useState("");

  const [toolServer, setToolServer] = useState("");
  const [toolName, setToolName] = useState("");
  const [toolInstructions, setToolInstructions] = useState("");
  const [toolOrigin, setToolOrigin] = useState("installed");

  const loadAll = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [reg, auditRes] = await Promise.all([
        getMcpIdentityRegistry(token),
        listMcpToolAudit(token, 30),
      ]);
      setRegistry(reg.registry);
      setBuiltinInfo(reg.builtinServerInfo ?? null);
      setAudit(auditRes.entries ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load MCP identity"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleRegisterServer() {
    if (!token || !serverName.trim()) return;
    setBusy("server");
    try {
      await registerMcpServer(token, {
        name: serverName.trim(),
        version: serverVersion,
        vendor: serverVendor,
        instructions: serverInstructions,
      });
      setServerName("");
      setNotice("MCP server registered.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to register server"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRegisterTool() {
    if (!token || !toolServer.trim() || !toolName.trim()) return;
    setBusy("tool");
    try {
      await registerMcpToolProvenance(token, {
        serverName: toolServer.trim(),
        toolName: toolName.trim(),
        instructions: toolInstructions,
        origin: toolOrigin,
      });
      setToolName("");
      setNotice("Tool provenance registered.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to register tool"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="MCP identity &amp; audit"
        description="Register MCP servers, tool provenance/instructions, and review tool-call audit log."
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
          {builtinInfo && (
            <Section title="Built-in FluxyChat MCP server">
              <Panel className="p-4 text-sm">
                <pre className="text-xs overflow-x-auto">{JSON.stringify(builtinInfo, null, 2)}</pre>
              </Panel>
            </Section>
          )}

          <Section title="Register MCP server">
            <Panel className="p-4 space-y-3 max-w-xl">
              <Input placeholder="Server name" value={serverName} onChange={(e) => setServerName(e.target.value)} />
              <div className="flex gap-2">
                <Input placeholder="Version" value={serverVersion} onChange={(e) => setServerVersion(e.target.value)} />
                <Input placeholder="Vendor" value={serverVendor} onChange={(e) => setServerVendor(e.target.value)} />
              </div>
              <Textarea placeholder="Server instructions (shown to agents)" rows={3} value={serverInstructions} onChange={(e) => setServerInstructions(e.target.value)} />
              <Button size="sm" disabled={!token || busy === "server"} onClick={() => void handleRegisterServer()}>
                {busy === "server" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                Register server
              </Button>
            </Panel>
          </Section>

          <Section title="Tool provenance">
            <Panel className="p-4 space-y-3 max-w-xl">
              <Input placeholder="Server name" value={toolServer} onChange={(e) => setToolServer(e.target.value)} list="mcp-servers" />
              <datalist id="mcp-servers">
                {registry?.servers.map((s) => <option key={s.name} value={s.name} />)}
              </datalist>
              <Input placeholder="Tool name" value={toolName} onChange={(e) => setToolName(e.target.value)} />
              <select className="rounded-md border border-border bg-background px-2 py-1.5 text-sm w-full" value={toolOrigin} onChange={(e) => setToolOrigin(e.target.value)}>
                <option value="installed">Installed</option>
                <option value="builtin">Built-in</option>
                <option value="remote">Remote</option>
              </select>
              <Textarea placeholder="Tool-specific instructions" rows={2} value={toolInstructions} onChange={(e) => setToolInstructions(e.target.value)} />
              <Button size="sm" disabled={!token || busy === "tool"} onClick={() => void handleRegisterTool()}>
                {busy === "tool" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Wrench className="h-3 w-3 mr-1" />}
                Register tool
              </Button>
            </Panel>
          </Section>

          <Section title="Registered servers &amp; tools">
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel className="p-4 space-y-2">
                <h3 className="text-sm font-semibold">Servers ({registry?.servers.length ?? 0})</h3>
                {(registry?.servers ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No custom servers registered.</p>
                ) : (
                  registry?.servers.map((s) => (
                    <div key={s.name} className="border-b border-border pb-2 last:border-0">
                      <p className="text-sm font-medium">{s.name} <span className="text-muted-foreground">v{s.version}</span></p>
                      <p className="text-xs text-muted-foreground">{s.vendor} · {formatDateTime(s.registeredAt)}</p>
                    </div>
                  ))
                )}
              </Panel>
              <Panel className="p-4 space-y-2">
                <h3 className="text-sm font-semibold">Tools ({registry?.tools.length ?? 0})</h3>
                {(registry?.tools ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tool provenance entries.</p>
                ) : (
                  registry?.tools.map((t) => (
                    <div key={`${t.serverName}:${t.toolName}`} className="border-b border-border pb-2 last:border-0">
                      <p className="text-sm font-medium">{t.toolName}</p>
                      <p className="text-xs text-muted-foreground">{t.serverName} · <Badge variant="outline" className="text-[9px]">{t.origin}</Badge></p>
                    </div>
                  ))
                )}
              </Panel>
            </div>
          </Section>

          <Section title="Tool-call audit log">
            <Panel className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tool calls logged yet.</p>
              ) : (
                audit.map((entry) => (
                  <div key={entry.id} className="flex justify-between gap-2 border-b border-border pb-2 text-xs last:border-0">
                    <span><strong>{entry.serverName}</strong> / {entry.toolName}</span>
                    <span className="text-muted-foreground shrink-0">{formatDateTime(entry.timestamp)}</span>
                  </div>
                ))
              )}
            </Panel>
          </Section>
        </div>
      )}
    </ConsoleShell>
  );
}
