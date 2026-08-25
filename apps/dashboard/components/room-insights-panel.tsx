"use client";

/**
 * F1/F2/F4 dashboard surface — Room Insights panel.
 *
 * Renders live marginal cost, agent budget, recent agent runs, SQLite PITR
 * snapshot/restore, and a signed conversation attestation export.
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";

interface CostView {
  usage: {
    wsFramesIn: number;
    wsFramesOut: number;
    doRequests: number;
    billableRequests: number;
    handlerDurationMs: number;
  };
  estimatedUsd: {
    requests: number;
    duration: number;
    total: number;
    withinIncludedAllowance: boolean;
  };
}

interface BudgetView {
  monthlyTokenBudget: number | null;
  enabled: boolean;
  usedTokens: number;
  remainingTokens: number | null;
  monthKey: string;
}

interface AgentRunView {
  id: string;
  agentId: string;
  status: string;
  latencyMs: number | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  error: string | null;
  toolCalls: unknown[];
  createdAt: string;
}

interface Attestation {
  chainTipHash: string;
  attestationHash: string;
  eventCount: number;
  signature: string;
  generatedAt: string;
}

function fmtUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `<$0.01`;
  return `$${n.toFixed(2)}`;
}

function fmtCompact(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(n);
}

export function RoomInsightsPanel({ roomId, token }: { roomId: string; token: string }) {
  const [cost, setCost] = useState<CostView | null>(null);
  const [budget, setBudget] = useState<BudgetView | null>(null);
  const [attestation, setAttestation] = useState<Attestation | null>(null);
  const [runs, setRuns] = useState<AgentRunView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);
  const [sqlText, setSqlText] = useState("");
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlResult, setSqlResult] = useState<{ rowCount: number; truncated: boolean; rows: Array<Record<string, unknown>> } | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [pitr, setPitr] = useState<{
    pitrAvailable: boolean;
    retentionDays: number;
    currentBookmark: string | null;
    snapshots: Array<{ id: string; bookmark: string; label: string; createdAt: number }>;
  } | null>(null);
  const [pitrBusy, setPitrBusy] = useState(false);

  const base = getPublicWorkerUrl();

  const refresh = useCallback(async () => {
    if (!token || !roomId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [costRes, budgetRes, runsRes, pitrRes] = await Promise.all([
        fetch(`${base}/rooms/${encodeURIComponent(roomId)}/cost`, { headers }),
        fetch(`${base}/rooms/${encodeURIComponent(roomId)}/agent-budget`, { headers }),
        fetch(`${base}/rooms/${encodeURIComponent(roomId)}/agent-runs?limit=12`, { headers }),
        fetch(`${base}/rooms/${encodeURIComponent(roomId)}/pitr`, { headers }),
      ]);
      if (costRes.ok) {
        const body = await costRes.json();
        setCost(body.cost ?? null);
      }
      if (budgetRes.ok) {
        const body = await budgetRes.json();
        setBudget(body);
        setBudgetDraft(body.monthlyTokenBudget != null ? String(body.monthlyTokenBudget) : "");
      }
      if (runsRes.ok) {
        const body = await runsRes.json();
        setRuns(Array.isArray(body.runs) ? body.runs : []);
      }
      if (pitrRes.ok) {
        const body = await pitrRes.json();
        setPitr({
          pitrAvailable: Boolean(body.pitrAvailable),
          retentionDays: Number(body.retentionDays) || 30,
          currentBookmark: body.currentBookmark ?? null,
          snapshots: Array.isArray(body.snapshots) ? body.snapshots : [],
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, [base, roomId, token]);

  const pitrAction = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!token || !roomId) return;
      setPitrBusy(true);
      setError(null);
      try {
        const res = await fetch(`${base}/rooms/${encodeURIComponent(roomId)}/pitr`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.ok === false) {
          setError(typeof body.error === "string" ? body.error : body.reason || "PITR failed");
          return;
        }
        await refresh();
      } finally {
        setPitrBusy(false);
      }
    },
    [base, refresh, roomId, token],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveBudget = useCallback(async () => {
    const parsed = Number(budgetDraft);
    if (!token || !roomId || (budgetDraft.trim() && !Number.isFinite(parsed))) return;
    setSavingBudget(true);
    try {
      await fetch(`${base}/rooms/${encodeURIComponent(roomId)}/agent-budget`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          monthlyTokenBudget: budgetDraft.trim() ? parsed : null,
          enabled: true,
        }),
      });
      await refresh();
    } finally {
      setSavingBudget(false);
    }
  }, [base, budgetDraft, refresh, roomId, token]);

  const runSql = useCallback(async () => {
    if (!token || !roomId || !sqlText.trim()) return;
    setSqlRunning(true);
    setSqlError(null);
    try {
      const res = await fetch(`${base}/rooms/${encodeURIComponent(roomId)}/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sql: sqlText }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setSqlError(body.reason ?? `Query failed (${res.status})`);
        setSqlResult(null);
        return;
      }
      setSqlResult({ rowCount: body.rowCount, truncated: Boolean(body.truncated), rows: body.rows });
    } catch {
      setSqlError("Query request failed");
    } finally {
      setSqlRunning(false);
    }
  }, [base, roomId, sqlText, token]);

  const exportAttestation = useCallback(async () => {
    if (!token || !roomId) return;
    try {
      const res = await fetch(
        `${base}/rooms/${encodeURIComponent(roomId)}/attestation?limit=5000`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        setError(`Attestation unavailable (${res.status})`);
        return;
      }
      const body = await res.json();
      setAttestation(body.attestation ?? null);
      // Download the full verifiable bundle for third parties.
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attestation-${roomId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Attestation export failed");
    }
  }, [base, roomId, token]);

  const budgetPct =
    budget?.monthlyTokenBudget && budget.monthlyTokenBudget > 0
      ? Math.min(100, Math.round((budget.usedTokens / budget.monthlyTokenBudget) * 100))
      : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Room insights</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={loading}>
          {loading ? "…" : "↻"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* F1 — live marginal cost */}
        <section aria-label="Live marginal cost">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-muted-foreground">Marginal cost (this window)</span>
            {cost?.estimatedUsd.withinIncludedAllowance && (
              <Badge variant="secondary">within included allowance</Badge>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {cost ? fmtUsd(cost.estimatedUsd.total) : "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              {cost
                ? `${fmtCompact(cost.usage.billableRequests)} req · ${fmtCompact(cost.usage.handlerDurationMs)} ms compute`
                : "loading"}
            </span>
          </div>
        </section>

        {/* F2 — agent budget circuit breaker */}
        <section aria-label="Agent budget">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-muted-foreground">Agent tokens ({budget?.monthKey ?? "—"})</span>
            {budget?.monthlyTokenBudget != null && (
              <Badge variant={budgetPct >= 100 ? "destructive" : budgetPct >= 80 ? "outline" : "secondary"}>
                {budgetPct}%
              </Badge>
            )}
          </div>
          {budget?.monthlyTokenBudget != null ? (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${
                    budgetPct >= 100 ? "bg-destructive" : budgetPct >= 80 ? "bg-yellow-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {fmtCompact(budget.usedTokens)} / {fmtCompact(budget.monthlyTokenBudget)} tokens ·{" "}
                {budget.remainingTokens != null ? `${fmtCompact(budget.remainingTokens)} left` : "uncapped"}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No cap configured — agents uncapped.</p>
          )}
          <div className="mt-2 flex gap-2">
            <input
              className="h-8 w-32 rounded-md border bg-transparent px-2 text-xs"
              placeholder="monthly token cap"
              inputMode="numeric"
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(e.target.value)}
            />
            <Button size="sm" variant="outline" onClick={() => void saveBudget()} disabled={savingBudget}>
              {savingBudget ? "Saving…" : "Set cap"}
            </Button>
          </div>
        </section>

        <section aria-label="Agent run inspector">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-muted-foreground">Agent runs</span>
            <span className="text-[10px] text-muted-foreground">{runs.length} recent</span>
          </div>
          {runs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No agent runs in this room yet.</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-auto text-xs">
              {runs.map((run) => (
                <li key={run.id} className="rounded border px-2 py-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-mono">{run.agentId.slice(0, 12)}</span>
                    <span>{run.status}</span>
                  </div>
                  <p className="text-muted-foreground">
                    {fmtCompact(run.inputTokens + run.outputTokens)} tokens
                    {run.latencyMs != null ? ` · ${run.latencyMs} ms` : ""}
                    {Array.isArray(run.toolCalls) && run.toolCalls.length
                      ? ` · ${run.toolCalls.length} tools`
                      : ""}
                  </p>
                  {run.error ? <p className="text-destructive">{run.error}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Room SQLite PITR — 30-day bookmarks, restore on next wake */}
        <section aria-label="Room SQLite point-in-time recovery">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-muted-foreground">Room SQLite recovery (30 days)</span>
            <Button
              size="sm"
              variant="outline"
              disabled={pitrBusy}
              onClick={() => void pitrAction({ action: "snapshot", label: "manual" })}
            >
              {pitrBusy ? "Working…" : "Snapshot now"}
            </Button>
          </div>
          {pitr ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                {pitr.pitrAvailable ? "PITR armed on this Durable Object" : "Waiting for SQLite bookmark API"}
                {" · "}
                {pitr.retentionDays}d retention
              </p>
              {pitr.currentBookmark ? (
                <p className="break-all font-mono text-[10px]">{pitr.currentBookmark.slice(0, 48)}…</p>
              ) : null}
              {pitr.snapshots.length === 0 ? (
                <p>No named snapshots yet. Alarm checkpoints land hourly; snapshot before a risky cutover.</p>
              ) : (
                <ul className="max-h-28 space-y-1 overflow-auto">
                  {pitr.snapshots.map((snap) => (
                    <li key={snap.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {snap.label} · {new Date(snap.createdAt).toISOString().slice(0, 16)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        disabled={pitrBusy}
                        onClick={() =>
                          void pitrAction({ action: "restore", snapshotId: snap.id, bookmark: snap.bookmark })
                        }
                      >
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Load a room to see recovery points.</p>
          )}
        </section>

        {/* F5 — room-as-database console */}
        <section aria-label="Room SQL">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-muted-foreground">Query this room (read-only SQL)</span>
          </div>
          <textarea
            className="h-16 w-full rounded-md border bg-transparent px-2 py-1 font-mono text-xs"
            placeholder="SELECT user_id, COUNT(*) AS n FROM messages GROUP BY user_id"
            value={sqlText}
            onChange={(e) => setSqlText(e.target.value)}
          />
          <div className="mt-1 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void runSql()} disabled={sqlRunning || !sqlText.trim()}>
              {sqlRunning ? "Running…" : "Run"}
            </Button>
            {sqlResult && (
              <span className="text-xs text-muted-foreground">
                {sqlResult.rowCount} rows{sqlResult.truncated ? " (truncated)" : ""}
              </span>
            )}
            {sqlError && <span className="text-xs text-destructive">{sqlError}</span>}
          </div>
          {sqlResult?.rows && sqlResult.rows.length > 0 && (
            <pre className="mt-1 max-h-32 overflow-auto rounded-md border p-2 font-mono text-[10px] leading-tight">
              {JSON.stringify(sqlResult.rows, null, 2)}
            </pre>
          )}
        </section>
        {/* F4 — signed attestation */}
        <section aria-label="Conversation attestation">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-muted-foreground">Signed attestation</span>
            <Button size="sm" variant="outline" onClick={() => void exportAttestation()}>
              Export + sign
            </Button>
          </div>
          {attestation ? (
            <div className="space-y-0.5 text-xs text-muted-foreground">
              <p className="break-all">
                tip <code className="font-mono">{attestation.chainTipHash.slice(0, 16)}…</code> ·{" "}
                {attestation.eventCount} events
              </p>
              <p className="break-all">
                anchor <code className="font-mono">{attestation.attestationHash.slice(0, 16)}…</code>
              </p>
              <p>Bundle downloaded — verifiable offline via @fluxy-chat/sdk.</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Export a hash-chained, signed snapshot any third party can verify offline.
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}