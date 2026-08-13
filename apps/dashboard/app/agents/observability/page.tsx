"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Bot, RefreshCw } from "lucide-react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { Badge } from "@/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { RoomPicker } from "../../components/room-picker";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { Banner, Button, EmptyState, Input, Panel, SkeletonCard } from "../../components/ui";
import { formatDateTime } from "@/lib/format-datetime";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";
import { createLangfuseOtelConfig, flushOtelQueue } from "@/lib/otel-export-client";

const WORKER_URL = getPublicWorkerUrl();

interface AgentRunRow {
  id: string;
  status: string;
  roomId?: string;
  createdAt: string;
  detail?: string;
  latencyMs?: number;
}

export default function AgentObservabilityPage() {
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();
  const [roomId, setRoomId] = useState("");
  const [rows, setRows] = useState<AgentRunRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [langfuseHost, setLangfuseHost] = useState("https://cloud.langfuse.com");
  const [langfusePublicKey, setLangfusePublicKey] = useState("");
  const [langfuseSecretKey, setLangfuseSecretKey] = useState("");
  const [langfuseBusy, setLangfuseBusy] = useState(false);
  const [langfuseNotice, setLangfuseNotice] = useState<string | null>(null);

  const client = useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({
      baseUrl: WORKER_URL,
      userId: "console",
      token,
    });
  }, [token]);

  const load = useCallback(async () => {
    if (!client) {
      setError("Connect a project session first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const activities = await client.listActivities({
        limit: 120,
        roomId: roomId.trim() || undefined,
      });
      const runs = activities
        .filter((a) => a.kind === "agent_run")
        .map((a) => ({
          id: a.id,
          status: a.status,
          roomId: a.roomId,
          createdAt: a.createdAt,
          detail: a.detail,
          latencyMs: parseLatency(a.detail),
        }));
      setRows(runs);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load agent runs"));
    } finally {
      setLoading(false);
    }
  }, [client, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const failed = rows.filter((r) => r.status === "failed" || r.status === "error").length;
    const latencies = rows.map((r) => r.latencyMs).filter((n): n is number => n != null && n > 0);
    const avgLatency =
      latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;
    return { total, failed, avgLatency };
  }, [rows]);

  async function handleCreateLangfuseConfig() {
    if (!adminJwt.trim()) {
      setError("Admin JWT required for OTel config.");
      return;
    }
    setLangfuseBusy(true);
    setLangfuseNotice(null);
    setError(null);
    try {
      const created = await createLangfuseOtelConfig(adminJwt.trim(), {
        host: langfuseHost.trim() || undefined,
        publicKey: langfusePublicKey.trim(),
        secretKey: langfuseSecretKey.trim(),
        name: "Langfuse agent traces",
      });
      await flushOtelQueue(adminJwt.trim(), created.id);
      setLangfuseSecretKey("");
      setLangfuseNotice(`Langfuse OTLP config ${created.id} created and flush queued.`);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create Langfuse OTel config"));
    } finally {
      setLangfuseBusy(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Agent observability"
        description="Recent agent runs from the activity feed: latency and failure rate for eval loops. Pair with OTel export for Langfuse."
      />

      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/agents" className="font-medium underline-offset-4 hover:underline">
          ← Agents
        </Link>
        {" · "}
        <Link href="/activities" className="font-medium underline-offset-4 hover:underline">
          Full activity feed
        </Link>
        {" · "}
        <Link href="/middleware" className="font-medium underline-offset-4 hover:underline">
          OTel middleware
        </Link>
        {" · "}
        <Link href="/agents/eval" className="font-medium underline-offset-4 hover:underline">
          Eval datasets
        </Link>
      </p>

      {error ? <Banner variant="error">{error}</Banner> : null}
      {langfuseNotice ? <Banner variant="info">{langfuseNotice}</Banner> : null}

      <Panel className="mb-6 space-y-3 p-4">
        <h2 className="text-sm font-semibold">Langfuse OTLP (OSS or Cloud)</h2>
        <p className="text-xs text-muted-foreground">
          One-click OTel export to Langfuse. Self-host: use your VPS URL (e.g. https://langfuse.example.com).{" "}
          <a
            href="https://github.com/fluxychat/Chat/blob/main/docs/LANGFUSE_VPS_RUNBOOK.md"
            className="font-medium underline-offset-2 hover:underline"
          >
            Langfuse VPS runbook
          </a>
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input placeholder="Langfuse host" value={langfuseHost} onChange={(e) => setLangfuseHost(e.target.value)} />
          <Input placeholder="Public key (pk-lf-…)" value={langfusePublicKey} onChange={(e) => setLangfusePublicKey(e.target.value)} />
          <Input
            type="password"
            className="sm:col-span-2"
            placeholder="Secret key (sk-lf-…)"
            value={langfuseSecretKey}
            onChange={(e) => setLangfuseSecretKey(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          disabled={langfuseBusy || !langfusePublicKey.trim() || !langfuseSecretKey.trim()}
          onClick={() => void handleCreateLangfuseConfig()}
        >
          {langfuseBusy ? "Creating…" : "Create Langfuse OTel export"}
        </Button>
      </Panel>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <RoomPicker token={token} allowEmpty emptyLabel="All rooms" value={roomId} onChange={setRoomId} />
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">Runs (sample)</p>
          <p className="text-2xl font-semibold">{stats.total}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">Failed</p>
          <p className="text-2xl font-semibold text-destructive">{stats.failed}</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs text-muted-foreground">Avg latency</p>
          <p className="text-2xl font-semibold">{stats.avgLatency != null ? `${stats.avgLatency} ms` : "—"}</p>
        </Panel>
      </div>

      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agent runs"
          description="Trigger an in-room agent or adjust the room filter."
        />
      ) : (
        <ul className="divide-y rounded-lg border border-border bg-card">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-xs">{r.id.slice(0, 8)}…</span>
                <Badge variant={r.status === "failed" ? "destructive" : "secondary"}>{r.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {r.roomId ?? "—"} · {formatDateTime(r.createdAt)}
                {r.latencyMs ? ` · ${r.latencyMs} ms` : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ConsoleShell>
  );
}

function parseLatency(detail?: string): number | undefined {
  if (!detail) return undefined;
  const m = /(\d+)\s*ms/i.exec(detail);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}
