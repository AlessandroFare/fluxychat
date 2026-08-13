"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import { exportAuditChain, exportAuditChainToR2, verifyAuditChain } from "@/lib/audit-chain-client";

export default function AuditChainPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verify, setVerify] = useState<{ valid: boolean; count: number; tipHash?: string } | null>(null);
  const [entries, setEntries] = useState<Array<{ id: number; eventHash: string; event: unknown; createdAt: string }>>([]);
  const [r2Notice, setR2Notice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [v, e] = await Promise.all([verifyAuditChain(token), exportAuditChain(token, 50)]);
      setVerify({ valid: v.valid, count: v.count, tipHash: v.tipHash });
      setEntries(e.entries ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load audit chain"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRefresh() {
    setBusy(true);
    await load();
    setBusy(false);
  }

  async function handleExportR2() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setR2Notice(null);
    try {
      const result = await exportAuditChainToR2(token);
      if (!result.ok) {
        setError(result.error ?? "R2 export failed");
        return;
      }
      setR2Notice(`Archived ${result.entryCount ?? 0} entries to R2 key ${result.key}`);
    } catch (err) {
      setError(messageFromUnknown(err, "R2 export failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Immutable audit chain"
        description="Append-only SHA-256 hash chain for tamper-evident audit export."
      />

      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/soc2" className="font-medium underline-offset-4 hover:underline">
          ← SOC 2
        </Link>
        {" · "}
        <Link href="/settings/retention" className="font-medium underline-offset-4 hover:underline">
          Retention
        </Link>
      </p>

      <ConsoleFeedback error={error} notice={r2Notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">Admin JWT required.</Panel>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" /> Verifying chain…
        </p>
      ) : (
        <div className="space-y-6">
          <Panel className="flex flex-wrap items-center gap-4 p-4">
            {verify?.valid ? (
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            ) : (
              <XCircle className="h-8 w-8 text-destructive" />
            )}
            <div>
              <p className="font-medium">
                Chain {verify?.valid ? "valid" : "broken or empty"} · {verify?.count ?? 0} entries
              </p>
              {verify?.tipHash ? (
                <p className="font-mono text-xs text-muted-foreground">tip: {verify.tipHash.slice(0, 16)}…</p>
              ) : null}
            </div>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void handleRefresh()} aria-label="Re-verify audit chain">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <ShieldCheck className="mr-2 h-4 w-4" aria-hidden />}
              Re-verify
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void handleExportR2()} aria-label="Export audit chain to R2">
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Archive to R2
            </Button>
          </Panel>

          <Section title="Recent chain entries">
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No chain entries yet. Operational audits append automatically.</p>
            ) : (
              <ul className="divide-y rounded-lg border border-border">
                {entries.map((e) => (
                  <li key={e.id} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">#{e.id}</Badge>
                      <span className="font-mono text-xs text-muted-foreground">{e.eventHash.slice(0, 12)}…</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</span>
                    </div>
                    <pre className="mt-1 max-h-24 overflow-auto text-xs text-muted-foreground">
                      {JSON.stringify(e.event, null, 0)}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Download className="h-3 w-3" /> Full export: GET /admin/audit-chain/export
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              For true WORM compliance, enable R2 Object Lock on the audit archive bucket (ops). Exports are hash-chained
              in D1 and cold-archived to R2 via the export button above.
            </p>
          </Section>
        </div>
      )}
    </ConsoleShell>
  );
}
