"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Download, Loader2, ShieldCheck } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { useDashboardSession } from "../components/dashboard-session";
import { fetchWorker, fetchWorkerJson } from "@/lib/worker-fetch";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";
import { docsSiteHref } from "@/lib/hosted-product";

interface Soc2Dashboard {
  controls?: Array<{ status: string; count: number }>;
  risks?: Array<{ riskLevel: string; status: string; count: number }>;
  incidents?: Array<{ severity: string; status: string; count: number }>;
  policies?: Array<{ status: string; count: number }>;
}

interface Soc2SelfAssessment {
  summary?: {
    readinessScore?: number;
    checklistItems?: number;
    automatedMetSignals?: number;
    controlsTracked?: number;
    evidenceArtifacts?: number;
    activePolicies?: number;
    openIncidents?: number;
  };
  disclaimer?: string;
}

interface DlpScanResult {
  matchCount?: number;
  redactedText?: string;
  matches?: Array<{ type?: string; severity?: string }>;
}

export default function Soc2Page() {
  const { adminJwt } = useDashboardSession();
  const [dashboard, setDashboard] = useState<Soc2Dashboard | null>(null);
  const [busy, setBusy] = useState<"load" | "export" | "audit" | "dlp" | "self" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [selfAssessment, setSelfAssessment] = useState<Soc2SelfAssessment | null>(null);
  const [dlpSample, setDlpSample] = useState("Test PCI 4111111111111111 and PHI SSN 123-45-6789");
  const [dlpResult, setDlpResult] = useState<DlpScanResult | null>(null);
  const workerUrl = getPublicWorkerUrl();

  const loadDashboard = useCallback(async () => {
    const token = adminJwt.trim();
    if (!token) {
      setStatus("Admin JWT required. Complete onboarding first.");
      return;
    }
    setBusy("load");
    setStatus(null);
    try {
      const data = await fetchWorkerJson<Soc2Dashboard>(`${workerUrl}/api/soc2/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDashboard(data);
      setStatus("Dashboard loaded.");
    } catch (e: unknown) {
      setStatus(messageFromUnknown(e, "Failed to load SOC2 dashboard."));
    } finally {
      setBusy(null);
    }
  }, [adminJwt, workerUrl]);

  const exportEvidence = useCallback(async () => {
    const token = adminJwt.trim();
    if (!token) {
      setStatus("Admin JWT required.");
      return;
    }
    setBusy("export");
    try {
      const rows = await fetchWorkerJson<{ evidence?: unknown[] }>(`${workerUrl}/api/soc2/evidence`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `soc2-evidence-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Evidence export downloaded.");
    } catch (e: unknown) {
      setStatus(messageFromUnknown(e, "Export failed."));
    } finally {
      setBusy(null);
    }
  }, [adminJwt, workerUrl]);

  const exportSelfAssessment = useCallback(async () => {
    const token = adminJwt.trim();
    if (!token) {
      setStatus("Admin JWT required.");
      return;
    }
    setBusy("self");
    try {
      const data = await fetchWorkerJson<Soc2SelfAssessment & Record<string, unknown>>(
        `${workerUrl}/api/soc2/self-assessment`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setSelfAssessment(data);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `soc2-self-assessment-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Self-assessment exported (${data.summary?.readinessScore ?? 0}% automated signal coverage).`);
    } catch (e: unknown) {
      setStatus(messageFromUnknown(e, "Self-assessment export failed."));
    } finally {
      setBusy(null);
    }
  }, [adminJwt, workerUrl]);

  const exportAuditLog = useCallback(async () => {
    const token = adminJwt.trim();
    if (!token) {
      setStatus("Admin JWT required.");
      return;
    }
    setBusy("audit");
    try {
      const res = await fetchWorker(
        `${workerUrl}/admin/audit-export/stream?format=json`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const text = await res.text();
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Audit log export downloaded.");
    } catch (e: unknown) {
      setStatus(messageFromUnknown(e, "Audit export failed."));
    } finally {
      setBusy(null);
    }
  }, [adminJwt, workerUrl]);

  const runDlpScan = useCallback(async () => {
    const token = adminJwt.trim();
    if (!token) {
      setStatus("Admin JWT required.");
      return;
    }
    setBusy("dlp");
    setDlpResult(null);
    try {
      const result = await fetchWorkerJson<DlpScanResult>(`${workerUrl}/enterprise/dlp/scan`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: dlpSample }),
      });
      setDlpResult(result);
      setStatus(`DLP scan: ${result.matchCount ?? 0} match(es).`);
    } catch (e: unknown) {
      setStatus(messageFromUnknown(e, "DLP scan failed."));
    } finally {
      setBusy(null);
    }
  }, [adminJwt, dlpSample, workerUrl]);

  return (
    <ConsoleShell className="max-w-4xl">
      <ConsolePageHeader
        title="SOC 2 Compliance"
        description="Controls, evidence, risks, and policy acknowledgments for SOC 2 prep."
        actions={
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void loadDashboard()}>
            {busy === "load" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1 h-3.5 w-3.5" />}
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy !== null} onClick={() => void exportEvidence()}>
          {busy === "export" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
          Export evidence JSON
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void exportSelfAssessment()}>
          {busy === "self" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
          Export self-assessment
        </Button>
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void exportAuditLog()}>
          {busy === "audit" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
          Export audit log
        </Button>
        <Link href="/soc2/audit-chain" className="inline-flex">
          <Button size="sm" variant="outline" type="button">
            Verify hash chain
          </Button>
        </Link>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Full happy path in{" "}
        <a href={docsSiteHref("guides/enterprise/dlp-audit-export")} className="font-medium underline-offset-2 hover:underline">
          DLP &amp; audit export guide
        </a>
        {" · "}
        <a href={docsSiteHref("guides/enterprise/soc2-readiness-checklist")} className="font-medium underline-offset-2 hover:underline">
          SOC 2 readiness checklist
        </a>
        {" · "}
        <a href={docsSiteHref("guides/enterprise/iso27001-mapping")} className="font-medium underline-offset-2 hover:underline">
          ISO 27001 mapping
        </a>
        {" · "}
        <a href={docsSiteHref("guides/enterprise/soc2-hipaa-runbook")} className="font-medium underline-offset-2 hover:underline">
          SOC 2 / HIPAA runbook
        </a>
        {" · "}
        <a href={docsSiteHref("guides/enterprise/soc2-type-ii-audit")} className="font-medium underline-offset-2 hover:underline">
          SOC 2 Type II audit guide
        </a>
        {" · "}
        <Link href="/settings/hipaa" className="font-medium underline-offset-2 hover:underline">
          HIPAA settings
        </Link>
        {" · "}
        <Link href="/settings/status" className="font-medium underline-offset-2 hover:underline">
          Public status page
        </Link>
        .
      </p>

      <Panel className="mt-6 p-4">
        <h3 className="text-sm font-semibold">DLP scan (PHI / PCI)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Test built-in patterns before messages are persisted. Uses <code className="text-[11px]">POST /enterprise/dlp/scan</code>.
        </p>
        <Input
          className="mt-3 font-mono text-xs"
          value={dlpSample}
          onChange={(e) => setDlpSample(e.target.value)}
        />
        <Button size="sm" className="mt-2" disabled={busy !== null} onClick={() => void runDlpScan()}>
          {busy === "dlp" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Run scan
        </Button>
        {dlpResult ? (
          <pre className="mt-3 max-h-40 overflow-auto rounded border bg-muted/40 p-2 text-[11px]">
            {JSON.stringify({ matchCount: dlpResult.matchCount, redactedText: dlpResult.redactedText, matches: dlpResult.matches }, null, 2)}
          </pre>
        ) : null}
      </Panel>

      {status ? <p className="mt-3 text-sm text-muted-foreground">{status}</p> : null}

      {dashboard ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Panel className="p-4">
            <h3 className="text-sm font-semibold">Controls</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {(dashboard.controls ?? []).map((row) => (
                <Badge key={row.status} variant="outline">{row.status}: {row.count}</Badge>
              ))}
            </div>
          </Panel>
          <Panel className="p-4">
            <h3 className="text-sm font-semibold">Policies</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {(dashboard.policies ?? []).map((row) => (
                <Badge key={row.status} variant="outline">{row.status}: {row.count}</Badge>
              ))}
            </div>
          </Panel>
          <Panel className="p-4 sm:col-span-2">
            <h3 className="text-sm font-semibold">Open risks & incidents</h3>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {(dashboard.risks ?? []).map((r, i) => (
                <li key={`r-${i}`}>{r.riskLevel} / {r.status}: {r.count}</li>
              ))}
              {(dashboard.incidents ?? []).map((r, i) => (
                <li key={`i-${i}`}>{r.severity} / {r.status}: {r.count}</li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : (
        <Panel className="mt-6 p-6 text-sm text-muted-foreground">
          Load dashboard with admin JWT to view SOC2 control status and export evidence packs for auditors.
        </Panel>
      )}

      {selfAssessment?.summary ? (
        <Panel className="mt-4 p-4">
          <h3 className="text-sm font-semibold">Self-assessment snapshot</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Automated signal coverage. Not a formal SOC 2 attestation. {selfAssessment.disclaimer}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">Score: {selfAssessment.summary.readinessScore}%</Badge>
            <Badge variant="outline">Checklist: {selfAssessment.summary.checklistItems}</Badge>
            <Badge variant="outline">Met signals: {selfAssessment.summary.automatedMetSignals}</Badge>
            <Badge variant="outline">Controls: {selfAssessment.summary.controlsTracked}</Badge>
            <Badge variant="outline">Evidence: {selfAssessment.summary.evidenceArtifacts}</Badge>
          </div>
        </Panel>
      ) : null}
    </ConsoleShell>
  );
}
