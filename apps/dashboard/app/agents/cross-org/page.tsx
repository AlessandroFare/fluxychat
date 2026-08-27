"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Handshake, Loader2, Plus } from "lucide-react";
import {
  buildAgentCardPayload,
  generateAgentIdentityKeyPair,
  signAgentCard,
} from "@fluxy-chat/sdk";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  approveCrossOrgCommitment,
  counterCrossOrgCommitment,
  createCrossOrgRoom,
  listCrossOrgAudit,
  listCrossOrgCommitments,
  listCrossOrgRooms,
  proposeCrossOrgCommitment,
  registerCrossOrgAgent,
  type CrossOrgCommitment,
  type CrossOrgRoom,
} from "@/lib/cross-org-client";

export default function CrossOrgAgentsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [rooms, setRooms] = useState<CrossOrgRoom[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [commitments, setCommitments] = useState<CrossOrgCommitment[]>([]);
  const [auditCount, setAuditCount] = useState(0);

  const [name, setName] = useState("Pilot negotiation");
  const [orgAId, setOrgAId] = useState("org-alpha.example.com");
  const [orgBId, setOrgBId] = useState("org-beta.example.com");
  const [termsJson, setTermsJson] = useState(
    '{"sku":"WIDGET-1","quantity":100,"unit_price_usd":12.5,"floorPrice":10}',
  );
  const [counterTermsJson, setCounterTermsJson] = useState(
    '{"sku":"WIDGET-1","quantity":80,"unit_price_usd":11.75,"floorPrice":10}',
  );

  const selected = rooms.find((r) => r.id === selectedId) ?? null;

  const loadRooms = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await listCrossOrgRooms(token);
      const list = data.rooms ?? [];
      setRooms(list);
      setSelectedId((prev) => prev || list[0]?.id || "");
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load cross-org rooms"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadRoomDetail = useCallback(async () => {
    if (!token || !selectedId) return;
    try {
      const [c, a] = await Promise.all([
        listCrossOrgCommitments(token, selectedId),
        listCrossOrgAudit(token, selectedId),
      ]);
      setCommitments(c.commitments ?? []);
      setAuditCount(a.entries?.length ?? 0);
    } catch {
      setCommitments([]);
      setAuditCount(0);
    }
  }, [token, selectedId]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    void loadRoomDetail();
  }, [loadRoomDetail]);

  async function handleCreateRoom() {
    if (!token) return;
    setBusy("create");
    setError(null);
    try {
      const result = await createCrossOrgRoom(token, {
        name: name.trim(),
        orgAId: orgAId.trim(),
        orgBId: orgBId.trim(),
      });
      setNotice(`Cross-org room created. Chat room ${result.room.roomId}.`);
      setSelectedId(result.room.id);
      await loadRooms();
    } catch (err) {
      setError(messageFromUnknown(err, "Create failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRegisterOrgA() {
    if (!token || !selected) return;
    setBusy("reg-a");
    try {
      const { publicKeyB64, privateKey } = await generateAgentIdentityKeyPair();
      const card = buildAgentCardPayload({
        agentId: "procurement-agent",
        orgId: selected.orgAId,
        publicKeyB64,
        capabilities: ["negotiate.purchase_order"],
        name: "Procurement Agent",
      });
      const signed = await signAgentCard(card, privateKey);
      await registerCrossOrgAgent(token, selected.id, {
        orgId: selected.orgAId,
        agentId: "procurement-agent",
        publicKeyB64,
        capabilities: card.capabilities,
        card: { ...signed.card, signature: signed.signature },
      });
      setNotice("Org A agent registered with signed Agent Card.");
      await loadRooms();
    } catch (err) {
      setError(messageFromUnknown(err, "Register org A failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handlePropose() {
    if (!token || !selected) return;
    setBusy("propose");
    try {
      const terms = JSON.parse(termsJson) as Record<string, unknown>;
      await proposeCrossOrgCommitment(token, selected.id, {
        proposedByOrg: selected.orgAId,
        proposedByAgent: selected.orgAAgentId ?? "procurement-agent",
        terms,
      });
      setNotice("Commitment proposed. Awaiting counter or human approval.");
      await loadRoomDetail();
    } catch (err) {
      setError(messageFromUnknown(err, "Propose failed. Check JSON terms."));
    } finally {
      setBusy(null);
    }
  }

  async function handleRegisterOrgB() {
    if (!token || !selected) return;
    setBusy("reg-b");
    try {
      const { publicKeyB64, privateKey } = await generateAgentIdentityKeyPair();
      const card = buildAgentCardPayload({
        agentId: "sales-agent",
        orgId: selected.orgBId,
        publicKeyB64,
        capabilities: ["negotiate.purchase_order"],
        name: "Sales Agent",
      });
      const signed = await signAgentCard(card, privateKey);
      await registerCrossOrgAgent(token, selected.id, {
        orgId: selected.orgBId,
        agentId: "sales-agent",
        publicKeyB64,
        capabilities: card.capabilities,
        card: { ...signed.card, signature: signed.signature },
      });
      setNotice("Org B agent registered with signed Agent Card.");
      await loadRooms();
    } catch (err) {
      setError(messageFromUnknown(err, "Register org B failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleCounter() {
    if (!token || !selected || !commitments[0]) return;
    setBusy("counter");
    try {
      const terms = JSON.parse(counterTermsJson) as Record<string, unknown>;
      await counterCrossOrgCommitment(token, commitments[0].id, {
        counterByOrg: selected.orgBId,
        proposedByAgent: selected.orgBAgentId ?? "sales-agent",
        terms,
      });
      setNotice("Counter-offer submitted. Awaiting approval or next round.");
      await loadRoomDetail();
    } catch (err) {
      setError(messageFromUnknown(err, "Counter failed. Check JSON terms."));
    } finally {
      setBusy(null);
    }
  }

  async function handleApprove(orgId: string) {
    if (!token || !commitments[0]) return;
    setBusy(`approve-${orgId}`);
    try {
      await approveCrossOrgCommitment(token, commitments[0].id, orgId);
      setNotice(`Human approval recorded for ${orgId}.`);
      await loadRoomDetail();
    } catch (err) {
      setError(messageFromUnknown(err, "Approve failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell className="max-w-4xl">
      <ConsolePageHeader
        title="Cross-org agent rooms"
        description="Two orgs negotiate in one room. Agents propose terms; humans approve before anything executes."
      />

      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/agents/a2a" className="underline underline-offset-2">
          A2A protocol
        </Link>
        {" · "}
        <Link href="/compare#room-os" className="underline underline-offset-2">
          Compare: room OS for agents
        </Link>
        {" · "}
        <a
          href="https://docs.fluxychat.com/docs/guides/cross-org-negotiation"
          className="underline underline-offset-2"
          target="_blank"
          rel="noopener noreferrer"
        >
          Negotiation cookbook
        </a>
      </p>

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">Admin JWT required.</Panel>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="space-y-8">
          <Section title="Create pilot room">
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Room name" />
              <Input value={orgAId} onChange={(e) => setOrgAId(e.target.value)} placeholder="Org A id" />
              <Input value={orgBId} onChange={(e) => setOrgBId(e.target.value)} placeholder="Org B id" />
            </div>
            <Button className="mt-3" onClick={() => void handleCreateRoom()} disabled={busy === "create"}>
              {busy === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create cross-org room
            </Button>
          </Section>

          <Section title="Rooms">
            {rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cross-org rooms yet.</p>
            ) : (
              <ul className="space-y-2">
                {rooms.map((room) => (
                  <li key={room.id}>
                    <button
                      type="button"
                      className={`w-full rounded-lg border px-4 py-3 text-left text-sm ${
                        selectedId === room.id ? "border-brand bg-brand/5" : "border-border"
                      }`}
                      onClick={() => setSelectedId(room.id)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Handshake className="h-4 w-4 text-brand" />
                        <span className="font-medium">{room.name}</span>
                        <Badge variant="secondary">{room.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {room.orgAId} ↔ {room.orgBId} · chat{" "}
                        <Link href={`/rooms?room=${encodeURIComponent(room.roomId)}`} className="underline">
                          {room.roomId}
                        </Link>
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {selected ? (
            <Section title={`Pilot: ${selected.name}`}>
              <p className="mb-3 text-xs text-muted-foreground">
                Audit entries: {auditCount} · Max negotiation rounds: {selected.maxRounds}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void handleRegisterOrgA()} disabled={!!busy}>
                  Register Org A agent + card
                </Button>
                <Button variant="outline" size="sm" onClick={() => void handleRegisterOrgB()} disabled={!!busy}>
                  Register Org B agent + card
                </Button>
              </div>

              <label className="mt-4 block text-sm">
                <span className="mb-1 block font-medium">Commitment terms (JSON)</span>
                <p className="mb-2 text-xs text-muted-foreground">
                  Include <code className="text-[10px]">floorPrice</code> or{" "}
                  <code className="text-[10px]">min_price</code> to reject counters below your minimum.
                </p>
                <textarea
                  className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                  value={termsJson}
                  onChange={(e) => setTermsJson(e.target.value)}
                />
              </label>
              <Button className="mt-2" size="sm" onClick={() => void handlePropose()} disabled={busy === "propose"}>
                Propose commitment (Org A)
              </Button>

              {commitments.length > 0 ? (
                <Panel className="mt-4 p-4">
                  <p className="text-sm font-medium">Latest commitment</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    State: <Badge variant="outline">{commitments[0].state}</Badge> · round {commitments[0].roundNumber}
                  </p>
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px]">
                    {JSON.stringify(commitments[0].terms, null, 2)}
                  </pre>
                  {["proposed", "countered"].includes(commitments[0].state) ? (
                    <div className="mt-3 space-y-2">
                      <label className="block text-xs font-medium">Counter terms (Org B JSON)</label>
                      <textarea
                        className="min-h-[60px] w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                        value={counterTermsJson}
                        onChange={(e) => setCounterTermsJson(e.target.value)}
                      />
                      <Button size="sm" variant="secondary" onClick={() => void handleCounter()} disabled={busy === "counter"}>
                        Counter-offer (Org B)
                      </Button>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => void handleApprove(selected.orgAId)}
                    >
                      Human approve (Org A)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!busy}
                      onClick={() => void handleApprove(selected.orgBId)}
                    >
                      Human approve (Org B)
                    </Button>
                  </div>
                </Panel>
              ) : null}
            </Section>
          ) : null}
        </div>
      )}
    </ConsoleShell>
  );
}
