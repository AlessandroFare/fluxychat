"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ClipboardCheck, Loader2, Play, Plus, Upload, FlaskConical } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createAgentEvalDataset,
  captureFailedRunAsEvalCase,
  exportAgentRunsOtel,
  listAgentEvalDatasets,
  listAgentEvalRuns,
  runAgentEvalDataset,
  type AgentEvalDataset,
  type AgentEvalRunResult,
} from "@/lib/agent-eval-client";

export default function AgentEvalPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [datasets, setDatasets] = useState<AgentEvalDataset[]>([]);
  const [runs, setRuns] = useState<AgentEvalRunResult[]>([]);
  const [datasetName, setDatasetName] = useState("Agent smoke eval");
  const [captureRunId, setCaptureRunId] = useState("");

  const prodFailuresDataset = datasets.find((d) => d.name === "Prod failures (auto)");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [d, r] = await Promise.all([listAgentEvalDatasets(token), listAgentEvalRuns(token)]);
      setDatasets(d.datasets ?? []);
      setRuns(r.runs ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load eval data"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateDefault() {
    if (!token || !datasetName.trim()) return;
    setBusy("create");
    try {
      await createAgentEvalDataset(token, {
        name: datasetName.trim(),
        description: "Default smoke cases against recent agent_runs",
        cases: [
          { tag: "completed", expectedStatus: "completed", maxLatencyMs: 30000 },
          { tag: "fast", expectedStatus: "completed", maxLatencyMs: 5000 },
        ],
      });
      setNotice("Dataset created.");
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Create failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRun(datasetId: string) {
    if (!token) return;
    setBusy(`run-${datasetId}`);
    try {
      const res = await runAgentEvalDataset(token, datasetId);
      setNotice(`Eval ${res.status}: ${res.passCount} pass, ${res.failCount} fail`);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Eval run failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleExportOtel() {
    if (!token) return;
    setBusy("otel");
    try {
      const res = await exportAgentRunsOtel(token, 50);
      setNotice(`Exported ${res.spanCount} OTel spans — paste payload into Langfuse OTLP ingest.`);
    } catch (err) {
      setError(messageFromUnknown(err, "OTel export failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleCaptureFromRun() {
    if (!token || !captureRunId.trim()) return;
    setBusy("capture");
    try {
      const res = await captureFailedRunAsEvalCase(token, captureRunId.trim());
      if (res.duplicate) {
        setNotice(`Run already captured in dataset (${res.caseCount} cases).`);
      } else {
        setNotice(`Captured failed run → ${res.evalCase.tag} (${res.caseCount} cases in dataset).`);
      }
      setCaptureRunId("");
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Capture failed — run must exist and have status failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Agent eval datasets"
        description="Regression datasets scored against agent_runs — capture prod failures as test cases (#40)."
      />

      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/agents/observability" className="font-medium underline-offset-4 hover:underline">
          ← Observability
        </Link>
        {" · "}
        <Link href="/middleware" className="font-medium underline-offset-4 hover:underline">
          OTel middleware
        </Link>
        {" · "}
        Set <code className="text-xs">AGENT_EVAL_AUTO_CAPTURE_FAILED=true</code> on the worker for automatic capture.
      </p>

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">Admin JWT required.</Panel>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="space-y-8">
          <Section title="Create dataset">
            <div className="flex flex-wrap gap-2">
              <Input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} placeholder="Dataset name" />
              <Button size="sm" disabled={busy === "create"} onClick={() => void handleCreateDefault()}>
                {busy === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add smoke dataset
              </Button>
              <Button size="sm" variant="outline" disabled={busy === "otel"} onClick={() => void handleExportOtel()}>
                {busy === "otel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Export OTel spans
              </Button>
            </div>
          </Section>

          <Section title="Prod → test capture (#40)">
            <p className="mb-3 text-sm text-muted-foreground">
              Paste a failed <code className="text-xs">agent_run</code> id from{" "}
              <Link href="/agents/observability" className="underline-offset-4 hover:underline">
                observability
              </Link>
              . Creates or appends to the &quot;Prod failures (auto)&quot; dataset.
              {prodFailuresDataset ? (
                <span className="ml-1">
                  Current auto dataset: {prodFailuresDataset.cases.length} case
                  {prodFailuresDataset.cases.length === 1 ? "" : "s"}.
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                value={captureRunId}
                onChange={(e) => setCaptureRunId(e.target.value)}
                placeholder="Failed run UUID"
                className="min-w-[280px] font-mono text-xs"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={busy === "capture" || !captureRunId.trim()}
                onClick={() => void handleCaptureFromRun()}
              >
                {busy === "capture" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FlaskConical className="mr-2 h-4 w-4" />
                )}
                Capture as eval case
              </Button>
            </div>
          </Section>

          <Section title="Datasets">
            {datasets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No datasets yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border border-border">
                {datasets.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span>
                      <ClipboardCheck className="mr-1 inline h-4 w-4" />
                      {d.name}
                      <span className="ml-2 text-muted-foreground">{d.cases.length} cases</span>
                    </span>
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void handleRun(d.id)}>
                      {busy === `run-${d.id}` ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
                      Run eval
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Recent eval runs">
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No eval runs yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border border-border">
                {runs.map((r) => (
                  <li key={r.id} className="px-4 py-3 text-sm">
                    <Badge variant={r.status === "passed" ? "default" : r.status === "failed" ? "destructive" : "secondary"}>
                      {r.status}
                    </Badge>
                    <span className="ml-2 text-muted-foreground">
                      {r.passCount}/{r.passCount + r.failCount} pass · {formatDateTime(r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </ConsoleShell>
  );
}
