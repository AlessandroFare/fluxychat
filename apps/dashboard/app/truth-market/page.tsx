"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins, Gavel, Loader2, Plus } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleFeedback } from "../components/console-feedback";
import { Button, Input, Panel, Section } from "../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createTruthClaim,
  fileTruthDispute,
  getTruthClaimDetail,
  getTruthCredits,
  grantTruthCredits,
  listTruthClaims,
  resolveTruthDispute,
  type TruthClaim,
  type TruthDispute,
} from "@/lib/truth-market-client";

function stateBadgeVariant(state: string): "default" | "secondary" | "destructive" | "outline" {
  if (state === "open") return "default";
  if (state === "disputed") return "destructive";
  if (state === "verified_by_time") return "secondary";
  return "outline";
}

export default function TruthMarketPage() {
  const { adminJwt, activeProject } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [claims, setClaims] = useState<TruthClaim[]>([]);
  const [credits, setCredits] = useState(0);
  const [selected, setSelected] = useState<{ claim: TruthClaim; disputes: TruthDispute[] } | null>(null);

  const [roomId, setRoomId] = useState("");
  const [claimContent, setClaimContent] = useState("");
  const [stakeAmount, setStakeAmount] = useState("5");
  const [disputeEvidence, setDisputeEvidence] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [claimsRes, creditsRes] = await Promise.all([
        listTruthClaims(token),
        getTruthCredits(token),
      ]);
      setClaims(claimsRes.claims ?? []);
      setCredits(creditsRes.credits?.balance ?? 0);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load truth market"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateClaim() {
    if (!token || !roomId.trim() || !claimContent.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await createTruthClaim(token, roomId.trim(), {
        content: claimContent.trim(),
        stakeAmount: Number(stakeAmount) || 5,
      });
      setClaimContent("");
      setNotice("Claim staked");
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Create claim failed"));
    } finally {
      setBusy(false);
    }
  }

  async function openClaim(claimId: string) {
    if (!token) return;
    setBusy(true);
    try {
      const detail = await getTruthClaimDetail(token, claimId);
      setSelected({ claim: detail.claim, disputes: detail.disputes ?? [] });
    } catch (err) {
      setError(messageFromUnknown(err, "Load claim failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDispute(claimId: string) {
    if (!token || !disputeEvidence.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await fileTruthDispute(token, claimId, disputeEvidence.trim());
      setDisputeEvidence("");
      setNotice("Dispute filed");
      await openClaim(claimId);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Dispute failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(claimId: string, disputeId: string, outcome: "confirmed" | "rejected") {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await resolveTruthDispute(token, claimId, disputeId, outcome);
      setNotice(`Dispute ${outcome}`);
      await openClaim(claimId);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Resolve failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleGrantCredits() {
    if (!token) return;
    setBusy(true);
    try {
      await grantTruthCredits(token, { amount: 25, reason: "console_top_up" });
      setNotice("Credits granted");
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Grant failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Truth Market"
        description="Stake internal credits on verifiable claims. Disputes go to human arbitration. MVP uses credits, not real money."
        icon={Gavel}
      />
      <ConsoleFeedback error={error} notice={notice} />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary" className="gap-1">
              <Coins className="size-3" />
              {credits} credits
            </Badge>
            {activeProject?.id ? (
              <span className="text-muted-foreground">Project {activeProject.id}</span>
            ) : null}
            <Button type="button" size="sm" variant="outline" disabled={busy || !token} onClick={() => void handleGrantCredits()}>
              Grant +25 credits (admin)
            </Button>
          </div>

          <Panel>
            <Section title="Stake a claim" description="Attach a verifiable statement to a room. If undisputed before TTL, stake returns.">
              <div className="grid gap-3 sm:grid-cols-3">
                <Input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="roomId" />
                <Input value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} placeholder="Stake credits" />
                <Input value={claimContent} onChange={(e) => setClaimContent(e.target.value)} placeholder="Verifiable claim text" className="sm:col-span-3" />
              </div>
              <Button type="button" className="mt-3" disabled={busy || !token} onClick={() => void handleCreateClaim()}>
                <Plus className="size-4" />
                Stake claim
              </Button>
            </Section>
          </Panel>

          <Panel>
            <Section title="Open claims" description="Claims awaiting dispute or expiry.">
              {claims.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open claims.</p>
              ) : (
                <div className="space-y-2">
                  {claims.map((claim) => (
                    <button
                      key={claim.id}
                      type="button"
                      className="flex w-full flex-col gap-1 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50"
                      onClick={() => void openClaim(claim.id)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={stateBadgeVariant(claim.state)}>{claim.state}</Badge>
                        <span className="font-mono text-xs text-muted-foreground">{claim.roomId}</span>
                        <span className="text-xs">{claim.stakeAmount} credits</span>
                      </div>
                      <p className="line-clamp-2">{claim.content}</p>
                      <span className="text-xs text-muted-foreground">
                        Expires {formatDateTime(claim.expiresAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Section>
          </Panel>

          {selected ? (
            <Panel>
              <Section title="Claim detail" description={selected.claim.id}>
                <p className="text-sm">{selected.claim.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Staked by {selected.claim.stakedByUserId} · {selected.claim.stakeAmount} credits · {selected.claim.state}
                </p>

                {selected.claim.state === "open" ? (
                  <div className="mt-4 space-y-2">
                    <Input
                      value={disputeEvidence}
                      onChange={(e) => setDisputeEvidence(e.target.value)}
                      placeholder="Evidence for dispute"
                    />
                    <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => void handleDispute(selected.claim.id)}>
                      File dispute
                    </Button>
                  </div>
                ) : null}

                {selected.disputes.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {selected.disputes.map((d) => (
                      <div key={d.id} className="rounded-md border border-border p-3 text-sm">
                        <p className="font-medium">Dispute by {d.disputedByUserId}</p>
                        <p className="mt-1 text-muted-foreground">{d.evidence}</p>
                        {d.state === "pending" ? (
                          <div className="mt-2 flex gap-2">
                            <Button type="button" size="sm" disabled={busy} onClick={() => void handleResolve(selected.claim.id, d.id, "confirmed")}>
                              Confirm dispute
                            </Button>
                            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void handleResolve(selected.claim.id, d.id, "rejected")}>
                              Reject dispute
                            </Button>
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">Outcome: {d.outcome}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </Section>
            </Panel>
          ) : null}
        </div>
      )}
    </ConsoleShell>
  );
}
