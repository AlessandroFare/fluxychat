"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Archive, Loader2, Plus } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleFeedback } from "../components/console-feedback";
import { RoomPicker } from "../components/room-picker";
import { Button, Input, Panel, Section, Textarea } from "../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  addEdiscoveryCustodian,
  collectEdiscoveryEvidence,
  createEdiscoveryCase,
  getEdiscoveryStats,
  listEdiscoveryCases,
  listEdiscoveryCustodians,
  listEdiscoveryEvidence,
  listEdiscoveryPreservations,
  preserveEdiscoveryData,
  type EdiscoveryCase,
  type EdiscoveryCustodian,
  type EdiscoveryEvidence,
  type EdiscoveryPreservation,
  type EdiscoveryStats,
} from "@/lib/ediscovery-client";
import { docsSiteHref } from "@/lib/hosted-product";

export default function EdiscoveryPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [stats, setStats] = useState<EdiscoveryStats | null>(null);
  const [cases, setCases] = useState<EdiscoveryCase[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [custodians, setCustodians] = useState<EdiscoveryCustodian[]>([]);
  const [preservations, setPreservations] = useState<EdiscoveryPreservation[]>([]);
  const [evidence, setEvidence] = useState<EdiscoveryEvidence[]>([]);

  const [caseNumber, setCaseNumber] = useState("");
  const [caseTitle, setCaseTitle] = useState("");
  const [caseDescription, setCaseDescription] = useState("");

  const [custodianEmail, setCustodianEmail] = useState("");
  const [custodianName, setCustodianName] = useState("");
  const [preserveRoomId, setPreserveRoomId] = useState("");
  const [preserveReason, setPreserveReason] = useState("Legal hold for matter review");

  const [evidenceType, setEvidenceType] = useState("message");
  const [evidenceItemId, setEvidenceItemId] = useState("");
  const [evidenceRoomId, setEvidenceRoomId] = useState("");

  const loadCases = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [statsRes, casesRes] = await Promise.all([getEdiscoveryStats(token), listEdiscoveryCases(token)]);
      setStats(statsRes.stats);
      setCases(casesRes.cases ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load e-discovery data"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadCaseDetail = useCallback(
    async (caseId: string) => {
      if (!token) return;
      try {
        const [c, p, e] = await Promise.all([
          listEdiscoveryCustodians(token, caseId),
          listEdiscoveryPreservations(token, caseId),
          listEdiscoveryEvidence(token, caseId),
        ]);
        setCustodians(c.custodians ?? []);
        setPreservations(p.preservations ?? []);
        setEvidence(e.evidence ?? []);
        setSelectedId(caseId);
      } catch (err) {
        setError(messageFromUnknown(err, "Failed to load case detail"));
      }
    },
    [token],
  );

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  async function handleCreateCase() {
    if (!token || !caseNumber.trim() || !caseTitle.trim()) return;
    setBusy("case");
    try {
      const created = await createEdiscoveryCase(token, {
        caseNumber: caseNumber.trim(),
        title: caseTitle.trim(),
        description: caseDescription.trim() || undefined,
        priority: "normal",
      });
      setCaseNumber("");
      setCaseTitle("");
      setCaseDescription("");
      setNotice(`Case ${created.id} created.`);
      await loadCases();
      await loadCaseDetail(created.id);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create case"));
    } finally {
      setBusy(null);
    }
  }

  async function handleAddCustodian() {
    if (!token || !selectedId) return;
    setBusy("custodian");
    try {
      await addEdiscoveryCustodian(token, selectedId, {
        email: custodianEmail.trim() || undefined,
        name: custodianName.trim() || undefined,
      });
      setCustodianEmail("");
      setCustodianName("");
      setNotice("Custodian added.");
      await loadCaseDetail(selectedId);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to add custodian"));
    } finally {
      setBusy(null);
    }
  }

  async function handlePreserve() {
    if (!token || !selectedId) return;
    setBusy("preserve");
    try {
      await preserveEdiscoveryData(token, selectedId, {
        roomId: preserveRoomId.trim() || undefined,
        reason: preserveReason.trim() || undefined,
        dataTypes: "messages,attachments",
      });
      setNotice("Preservation order recorded.");
      await loadCaseDetail(selectedId);
    } catch (err) {
      setError(messageFromUnknown(err, "Preservation failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleCollectEvidence() {
    if (!token || !selectedId || !evidenceItemId.trim()) return;
    setBusy("evidence");
    try {
      await collectEdiscoveryEvidence(token, selectedId, {
        itemType: evidenceType.trim(),
        itemId: evidenceItemId.trim(),
        roomId: evidenceRoomId.trim() || undefined,
      });
      setEvidenceItemId("");
      setNotice("Evidence collected.");
      await loadCaseDetail(selectedId);
    } catch (err) {
      setError(messageFromUnknown(err, "Evidence collection failed"));
    } finally {
      setBusy(null);
    }
  }

  const selectedCase = cases.find((c) => c.id === selectedId) ?? null;

  return (
    <ConsoleShell className="max-w-4xl">
      <ConsolePageHeader
        title="E-discovery"
        description="Legal cases, custodians, preservation orders, and chain-of-custody evidence."
      />

      <p className="text-xs text-muted-foreground">
        Pair with{" "}
        <Link href="/settings/retention" className="font-medium underline-offset-2 hover:underline">
          retention &amp; legal hold
        </Link>{" "}
        and{" "}
        <a href={docsSiteHref("guides/enterprise/ediscovery")} className="font-medium underline-offset-2 hover:underline">
          e-discovery guide
        </a>
        .
      </p>

      <ConsoleFeedback error={error} notice={notice} className="mt-4" />

      {stats ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">
            <Archive className="mr-1 h-3 w-3" />
            {stats.totalCases} case(s)
          </Badge>
          <Badge variant="outline">{stats.totalEvidence} evidence item(s)</Badge>
        </div>
      ) : null}

      {loading ? (
        <Panel className="mt-6 flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </Panel>
      ) : null}

      {!token && !loading ? (
        <Panel className="mt-6 p-6 text-sm text-muted-foreground">Admin JWT required — copy from Projects.</Panel>
      ) : null}

      <Section title="New case" className="mt-8">
        <Panel className="max-w-xl space-y-3 p-4">
          <Input placeholder="Case number (e.g. MAT-2026-001)" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} />
          <Input placeholder="Title" value={caseTitle} onChange={(e) => setCaseTitle(e.target.value)} />
          <Textarea placeholder="Description" value={caseDescription} onChange={(e) => setCaseDescription(e.target.value)} rows={2} />
          <Button size="sm" disabled={!token || busy === "case"} onClick={() => void handleCreateCase()}>
            {busy === "case" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
            Create case
          </Button>
        </Panel>
      </Section>

      <Section title={`Cases (${cases.length})`} className="mt-8">
        {cases.length === 0 ? (
          <Panel className="p-4 text-sm text-muted-foreground">No cases yet.</Panel>
        ) : (
          <ul className="space-y-2">
            {cases.map((c) => (
              <li key={c.id}>
                <Panel className={`p-4 ${selectedId === c.id ? "ring-1 ring-primary" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.caseNumber} · {c.status} · opened {formatDateTime(c.openedAt)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void loadCaseDetail(c.id)}>
                      Open
                    </Button>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {selectedCase ? (
        <>
          <Section title={`Custodians — ${selectedCase.caseNumber}`} className="mt-8">
            <Panel className="space-y-3 p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input placeholder="Name" value={custodianName} onChange={(e) => setCustodianName(e.target.value)} />
                <Input placeholder="Email" value={custodianEmail} onChange={(e) => setCustodianEmail(e.target.value)} />
              </div>
              <Button size="sm" disabled={busy === "custodian"} onClick={() => void handleAddCustodian()}>
                Add custodian
              </Button>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {custodians.map((c) => (
                  <li key={c.id}>
                    {c.name ?? c.userId} {c.email ? `(${c.email})` : ""}
                  </li>
                ))}
              </ul>
            </Panel>
          </Section>

          <Section title="Preservation" className="mt-8">
            <Panel className="space-y-3 p-4">
              <RoomPicker token={token} value={preserveRoomId} onChange={setPreserveRoomId} />
              <Input value={preserveReason} onChange={(e) => setPreserveReason(e.target.value)} />
              <Button size="sm" disabled={busy === "preserve"} onClick={() => void handlePreserve()}>
                Record preservation
              </Button>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {preservations.map((p) => (
                  <li key={p.id}>
                    Room {p.roomId ?? "all"} · {p.status} · {p.reason}
                  </li>
                ))}
              </ul>
            </Panel>
          </Section>

          <Section title="Evidence" className="mt-8">
            <Panel className="space-y-3 p-4">
              <div className="grid gap-2 sm:grid-cols-3">
                <Input placeholder="itemType" value={evidenceType} onChange={(e) => setEvidenceType(e.target.value)} />
                <Input placeholder="itemId" value={evidenceItemId} onChange={(e) => setEvidenceItemId(e.target.value)} />
                <Input placeholder="roomId (optional)" value={evidenceRoomId} onChange={(e) => setEvidenceRoomId(e.target.value)} />
              </div>
              <Button size="sm" disabled={busy === "evidence"} onClick={() => void handleCollectEvidence()}>
                Collect evidence
              </Button>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {evidence.map((e) => (
                  <li key={e.id}>
                    {e.itemType} {e.itemId} · room {e.roomId ?? "—"} · {formatDateTime(e.collectedAt)}
                  </li>
                ))}
              </ul>
            </Panel>
          </Section>
        </>
      ) : null}
    </ConsoleShell>
  );
}
