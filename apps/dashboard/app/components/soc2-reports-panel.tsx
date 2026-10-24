"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Download, Loader2 } from "lucide-react";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";

export interface Soc2ReportRow {
  id: string;
  reportType: string;
  title: string;
  content?: string | null;
  status: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  createdAt: string;
}

function day(value?: string | null): string {
  return value ? value.slice(0, 10) : "";
}

export function Soc2ReportsPanel({ token, refreshKey = 0 }: { token: string; refreshKey?: number }) {
  const workerUrl = getPublicWorkerUrl();
  const [reports, setReports] = useState<Soc2ReportRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const auth = token.trim();
    if (!auth) return;
    let cancelled = false;
    async function load() {
      try {
        const rows = await fetchWorkerJson<Soc2ReportRow[]>(`${workerUrl}/api/soc2/reports`, {
          headers: { Authorization: `Bearer ${auth}` },
        });
        if (cancelled) return;
        setReports(Array.isArray(rows) ? rows : []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(messageFromUnknown(err, "Could not load saved reports."));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, workerUrl, refreshKey]);

  function download(report: Soc2ReportRow) {
    const blob = new Blob([report.content || ""], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${report.id}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function markFinal(report: Soc2ReportRow) {
    const auth = token.trim();
    if (!auth) return;
    setBusyId(report.id);
    try {
      await fetchWorkerJson(`${workerUrl}/api/soc2/reports/${report.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "final" }),
      });
      setReports((prev) => (prev || []).map((row) => (row.id === report.id ? { ...row, status: "final" } : row)));
      setError(null);
    } catch (err) {
      setError(messageFromUnknown(err, "Could not update the report."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel className="mt-4 p-4">
      <h3 className="text-sm font-semibold">Saved reports</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Evidence packs and other reports filed for this project (
        <code className="text-[11px]">GET /api/soc2/reports</code>).
      </p>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      {!token.trim() ? (
        <p className="mt-2 text-xs text-muted-foreground">Admin JWT required.</p>
      ) : reports === null ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading
        </p>
      ) : reports.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No report saved yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {reports.map((report) => (
            <li key={report.id} className="rounded border border-border px-3 py-2 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{report.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{report.reportType}</Badge>
                    <Badge variant={report.status === "final" ? "default" : "outline"}>{report.status}</Badge>
                    <span>{day(report.createdAt)}</span>
                    {report.periodStart && report.periodEnd ? (
                      <span>
                        {day(report.periodStart)} → {day(report.periodEnd)}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {report.content ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => setOpenId(openId === report.id ? null : report.id)}
                      >
                        {openId === report.id ? (
                          <ChevronUp className="mr-1 h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="mr-1 h-3.5 w-3.5" />
                        )}
                        {openId === report.id ? "Hide" : "View"}
                      </Button>
                      <Button size="sm" variant="outline" type="button" onClick={() => download(report)}>
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Download
                      </Button>
                    </>
                  ) : null}
                  {report.status === "draft" ? (
                    <Button size="sm" type="button" disabled={busyId !== null} onClick={() => void markFinal(report)}>
                      {busyId === report.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                      Mark final
                    </Button>
                  ) : null}
                </div>
              </div>
              {openId === report.id ? (
                <pre className="mt-2 max-h-64 overflow-auto rounded border bg-muted/40 p-2 text-[11px] whitespace-pre-wrap">
                  {report.content}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
