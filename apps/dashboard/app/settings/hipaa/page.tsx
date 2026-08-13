"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, HeartPulse, Loader2, Plus } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  BAA_TEMPLATE_MARKDOWN,
  createHipaaBaa,
  getHipaaDashboard,
  HIPAA_READINESS_CHECKLIST,
  listHipaaBaas,
  updateHipaaBaa,
  type HipaaBaa,
  type HipaaDashboard,
} from "@/lib/hipaa-client";
import { docsSiteHref } from "@/lib/hosted-product";

const CHECKLIST_STORAGE_KEY = "fluxy-hipaa-checklist-v1";

function loadCheckedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveCheckedIds(ids: Set<string>) {
  localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify([...ids]));
}

export default function HipaaSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<HipaaDashboard | null>(null);
  const [baas, setBaas] = useState<HipaaBaa[]>([]);
  const [checked, setChecked] = useState<Set<string>>(() => loadCheckedIds());
  const [busy, setBusy] = useState<string | null>(null);

  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState("covered_entity");
  const [contactEmail, setContactEmail] = useState("");

  const loadAll = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [dash, baaRows] = await Promise.all([getHipaaDashboard(token), listHipaaBaas(token)]);
      setDashboard(dash);
      setBaas(baaRows);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load HIPAA data"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveCheckedIds(next);
      return next;
    });
  }

  function downloadBaaTemplate() {
    const blob = new Blob([BAA_TEMPLATE_MARKDOWN], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fluxy-chat-baa-template.md";
    a.click();
    URL.revokeObjectURL(url);
    setNotice("BAA template downloaded. Have counsel review before signing.");
  }

  async function handleCreateBaa() {
    if (!token || !entityName.trim()) return;
    setBusy("baa");
    try {
      await createHipaaBaa(token, {
        entityName: entityName.trim(),
        entityType: entityType.trim(),
        contactEmail: contactEmail.trim() || undefined,
      });
      setEntityName("");
      setContactEmail("");
      setNotice("BAA record created (draft).");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create BAA"));
    } finally {
      setBusy(null);
    }
  }

  async function markBaaActive(baaId: string) {
    if (!token) return;
    setBusy(baaId);
    try {
      await updateHipaaBaa(token, baaId, { status: "active", signedBy: "dashboard-admin" });
      setNotice("BAA marked active. Attach signed PDF URL in API when available.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to update BAA"));
    } finally {
      setBusy(null);
    }
  }

  const checklistDone = HIPAA_READINESS_CHECKLIST.filter((c) => checked.has(c.id)).length;

  return (
    <ConsoleShell className="max-w-4xl">
      <ConsolePageHeader
        title="HIPAA readiness"
        description="BAA tracking, PHI access metrics, and a self-assessment checklist. Third-party Type 2 audit remains separate until revenue."
        actions={
          <Button size="sm" variant="outline" onClick={() => downloadBaaTemplate()}>
            <Download className="mr-1 h-3.5 w-3.5" />
            BAA template
          </Button>
        }
      />

      <p className="text-xs text-muted-foreground">
        Pair with{" "}
        <Link href="/soc2" className="font-medium underline-offset-2 hover:underline">
          SOC 2
        </Link>{" "}
        for evidence export and{" "}
        <a href={docsSiteHref("guides/enterprise/soc2-hipaa-runbook")} className="font-medium underline-offset-2 hover:underline">
          SOC 2 / HIPAA runbook
        </a>
        .
      </p>

      <ConsoleFeedback error={error} notice={notice} className="mt-4" />

      {loading ? (
        <Panel className="mt-6 flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </Panel>
      ) : null}

      {!token && !loading ? (
        <Panel className="mt-6 p-6 text-sm text-muted-foreground">
          Admin JWT required. Copy from Projects after onboarding.
        </Panel>
      ) : null}

      {dashboard ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Panel className="p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <HeartPulse className="h-4 w-4" /> BAA status
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {dashboard.baaStatus.length === 0 ? (
                <span className="text-xs text-muted-foreground">No BAAs yet</span>
              ) : (
                dashboard.baaStatus.map((r) => (
                  <Badge key={r.status} variant="outline">
                    {r.status}: {r.count}
                  </Badge>
                ))
              )}
            </div>
          </Panel>
          <Panel className="p-4">
            <h3 className="text-sm font-semibold">PHI detections</h3>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {dashboard.phiDetections.length === 0 ? (
                <li>None logged</li>
              ) : (
                dashboard.phiDetections.map((r, i) => (
                  <li key={i}>
                    {r.type} / {r.action}: {r.count}
                  </li>
                ))
              )}
            </ul>
          </Panel>
        </div>
      ) : null}

      <Section title="Readiness checklist" className="mt-8">
        <p className="text-xs text-muted-foreground">
          {checklistDone}/{HIPAA_READINESS_CHECKLIST.length} complete (stored in this browser).
        </p>
        <ul className="mt-3 space-y-2">
          {HIPAA_READINESS_CHECKLIST.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked.has(item.id)}
                  onChange={() => toggleCheck(item.id)}
                />
                {item.label}
              </label>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Business Associate Agreements" className="mt-8">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Entity name" value={entityName} onChange={(e) => setEntityName(e.target.value)} />
          <Input
            placeholder="Entity type (covered_entity | business_associate)"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          />
          <Input
            className="sm:col-span-2"
            placeholder="Contact email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </div>
        <Button size="sm" className="mt-3" disabled={busy !== null} onClick={() => void handleCreateBaa()}>
          {busy === "baa" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
          Create BAA record
        </Button>

        <ul className="mt-4 space-y-2">
          {baas.map((b) => (
            <li key={b.id} className="rounded border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{b.entityName}</span>
                <Badge variant={b.status === "active" ? "default" : "outline"}>{b.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {b.entityType} · created {formatDateTime(b.createdAt)}
                {b.signedAt ? ` · signed ${formatDateTime(b.signedAt)}` : null}
              </p>
              {b.status !== "active" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={busy !== null}
                  onClick={() => void markBaaActive(b.id)}
                >
                  {busy === b.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Mark signed / active
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>
    </ConsoleShell>
  );
}
