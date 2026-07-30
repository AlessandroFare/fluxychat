"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Megaphone, Plus, Send, Users } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleFeedback } from "../components/console-feedback";
import { Button, Input, Panel, Section, Textarea } from "../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createBroadcastCampaign,
  createBroadcastSegment,
  listBroadcastCampaigns,
  listBroadcastSegments,
  sendBroadcastCampaign,
  type BroadcastCampaign,
  type BroadcastSegment,
} from "@/lib/broadcast-client";
import {
  createCdpSegment,
  getCustomerStats,
  listCdpSegments,
  listCustomers,
  upsertCustomer,
  type CustomerProfile,
  type CustomerSegment,
  type CustomerStats,
} from "@/lib/cdp-client";
import {
  bindChannelIdentity,
  listIdentityBindings,
  listJourneyHistory,
  mergeCustomerProfiles,
  recordJourneyStep,
  type IdentityBinding,
  type JourneyStep,
} from "@/lib/cross-channel-client";

export default function CustomersPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [cdpSegments, setCdpSegments] = useState<CustomerSegment[]>([]);
  const [broadcastSegments, setBroadcastSegments] = useState<BroadcastSegment[]>([]);
  const [campaigns, setCampaigns] = useState<BroadcastCampaign[]>([]);

  const [extId, setExtId] = useState("");
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");

  const [segName, setSegName] = useState("");
  const [campName, setCampName] = useState("");
  const [campMessage, setCampMessage] = useState("Hello {{name}}, we have an update for you.");
  const [campSegmentId, setCampSegmentId] = useState("");

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [bindChannel, setBindChannel] = useState("web");
  const [bindUserId, setBindUserId] = useState("");
  const [mergeSecondaryId, setMergeSecondaryId] = useState("");
  const [bindings, setBindings] = useState<IdentityBinding[]>([]);
  const [journey, setJourney] = useState<JourneyStep[]>([]);

  const loadAll = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [s, c, cs, bs, camps] = await Promise.all([
        getCustomerStats(token),
        listCustomers(token, { limit: 50 }),
        listCdpSegments(token),
        listBroadcastSegments(token),
        listBroadcastCampaigns(token),
      ]);
      setStats(s);
      setCustomers(c);
      setCdpSegments(cs);
      setBroadcastSegments(bs.segments ?? []);
      setCampaigns(camps.campaigns ?? []);
      const bindRes = await listIdentityBindings(token);
      setBindings(bindRes.bindings ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load customer data"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleUpsertCustomer() {
    if (!token || !extId.trim()) return;
    setBusy("customer");
    try {
      await upsertCustomer(token, {
        externalId: extId.trim(),
        name: custName || undefined,
        email: custEmail || undefined,
        lifecycleStage: "lead",
      });
      setExtId("");
      setCustName("");
      setCustEmail("");
      setNotice("Customer saved.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save customer"));
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateSegment() {
    if (!token || !segName.trim()) return;
    setBusy("segment");
    try {
      await Promise.all([
        createCdpSegment(token, { name: segName.trim(), segmentType: "static" }),
        createBroadcastSegment(token, { name: segName.trim(), segmentType: "static" }),
      ]);
      setSegName("");
      setNotice("Segment created in CDP and broadcast.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create segment"));
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateCampaign() {
    if (!token || !campName.trim() || !campMessage.trim()) return;
    setBusy("campaign");
    try {
      await createBroadcastCampaign(token, {
        name: campName.trim(),
        messageTemplate: campMessage.trim(),
        segmentId: campSegmentId || undefined,
        channel: "in_app",
      });
      setCampName("");
      setNotice("Campaign created (draft).");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create campaign"));
    } finally {
      setBusy(null);
    }
  }

  async function handleSendCampaign(campaignId: string) {
    if (!token) return;
    setBusy(`send-${campaignId}`);
    try {
      await sendBroadcastCampaign(token, campaignId);
      setNotice("Campaign sending started.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Send failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleBindIdentity() {
    if (!token || !selectedCustomerId || !bindUserId.trim()) return;
    setBusy("bind");
    try {
      await bindChannelIdentity(token, {
        customerId: selectedCustomerId,
        channel: bindChannel,
        channelUserId: bindUserId.trim(),
      });
      setBindUserId("");
      setNotice("Channel identity bound.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Bind failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleMergeProfiles() {
    if (!token || !selectedCustomerId || !mergeSecondaryId.trim()) return;
    setBusy("merge");
    try {
      await mergeCustomerProfiles(token, selectedCustomerId, mergeSecondaryId.trim());
      setMergeSecondaryId("");
      setNotice("Profiles merged.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Merge failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleLoadJourney(customerId: string) {
    if (!token) return;
    setSelectedCustomerId(customerId);
    setBusy("journey");
    try {
      const res = await listJourneyHistory(token, customerId);
      setJourney(res.journey ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Journey load failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRecordJourney() {
    if (!token || !selectedCustomerId) return;
    setBusy("journey-record");
    try {
      await recordJourneyStep(token, {
        customerId: selectedCustomerId,
        channel: bindChannel,
        step: "page_view",
        metadata: { source: "dashboard" },
      });
      await handleLoadJourney(selectedCustomerId);
      setNotice("Journey step recorded.");
    } catch (err) {
      setError(messageFromUnknown(err, "Record failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Customers &amp; segments"
        description="Customer data layer (CDP), segments, and targeted broadcast campaigns."
      />
      <ConsoleFeedback error={error} notice={notice} />

      {!token && (
        <Panel className="p-4 text-sm text-muted-foreground">
          Admin JWT required — copy one from <Link href="/projects" className="text-primary underline">Projects</Link>.
        </Panel>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          {stats && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Panel className="p-4">
                <p className="text-xs text-muted-foreground">Total customers</p>
                <p className="text-2xl font-semibold">{stats.totalCustomers ?? 0}</p>
              </Panel>
              <Panel className="p-4">
                <p className="text-xs text-muted-foreground">Recent events (30d)</p>
                <p className="text-2xl font-semibold">{stats.recentEvents ?? 0}</p>
              </Panel>
              <Panel className="p-4">
                <p className="text-xs text-muted-foreground">Broadcast campaigns</p>
                <p className="text-2xl font-semibold">{campaigns.length}</p>
              </Panel>
            </div>
          )}

          <Section title="Customer profiles">
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel className="p-4 space-y-2">
                <Input placeholder="External ID" value={extId} onChange={(e) => setExtId(e.target.value)} />
                <Input placeholder="Name" value={custName} onChange={(e) => setCustName(e.target.value)} />
                <Input placeholder="Email" value={custEmail} onChange={(e) => setCustEmail(e.target.value)} />
                <Button size="sm" disabled={!token || busy === "customer"} onClick={() => void handleUpsertCustomer()}>
                  {busy === "customer" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                  Upsert customer
                </Button>
              </Panel>
              <Panel className="p-4 space-y-2 max-h-64 overflow-y-auto">
                {customers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No customers yet.</p>
                ) : (
                  customers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => void handleLoadJourney(c.id)}
                      className={`flex w-full justify-between border-b border-border pb-2 text-left text-sm last:border-0 ${selectedCustomerId === c.id ? "text-primary" : ""}`}
                    >
                      <span>{c.name || c.externalId}</span>
                      <span className="text-xs text-muted-foreground">{c.email} · {c.lifecycleStage}</span>
                    </button>
                  ))
                )}
              </Panel>
            </div>
          </Section>

          <Section title="Segments">
            <Panel className="p-4 space-y-3">
              <div className="flex gap-2 max-w-md">
                <Input placeholder="Segment name" value={segName} onChange={(e) => setSegName(e.target.value)} />
                <Button size="sm" disabled={!token || busy === "segment"} onClick={() => void handleCreateSegment()}>
                  <Users className="h-3 w-3 mr-1" /> Create
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">CDP segments ({cdpSegments.length})</p>
                  {cdpSegments.map((s) => (
                    <p key={s.id}>{s.name} <Badge variant="outline" className="text-[9px]">{s.customerCount} members</Badge></p>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Broadcast segments ({broadcastSegments.length})</p>
                  {broadcastSegments.map((s) => (
                    <p key={s.id}>{s.name} <Badge variant="outline" className="text-[9px]">{s.segmentType}</Badge></p>
                  ))}
                </div>
              </div>
            </Panel>
          </Section>

          <Section title="Broadcast campaigns">
            <Panel className="p-4 space-y-3">
              <Input placeholder="Campaign name" value={campName} onChange={(e) => setCampName(e.target.value)} />
              <Textarea rows={2} placeholder="Message template" value={campMessage} onChange={(e) => setCampMessage(e.target.value)} />
              <select className="rounded-md border border-border bg-background px-2 py-1.5 text-sm w-full max-w-xs" value={campSegmentId} onChange={(e) => setCampSegmentId(e.target.value)}>
                <option value="">All users (no segment)</option>
                {broadcastSegments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <Button size="sm" disabled={!token || busy === "campaign"} onClick={() => void handleCreateCampaign()}>
                <Megaphone className="h-3 w-3 mr-1" /> Create campaign
              </Button>
              {campaigns.length > 0 && (
                <div className="border-t border-border pt-3 space-y-2">
                  {campaigns.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>{c.name} · <Badge variant="secondary" className="text-[9px]">{c.status}</Badge></span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDateTime(c.createdAt)}</span>
                        {c.status === "draft" && (
                          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void handleSendCampaign(c.id)}>
                            <Send className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </Section>

          <Section title="Cross-channel identity &amp; journey">
            <Panel className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Selected customer: {selectedCustomerId || "click a profile above"}
              </p>
              <div className="grid gap-2 sm:grid-cols-3 max-w-2xl">
                <select className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={bindChannel} onChange={(e) => setBindChannel(e.target.value)}>
                  {["web", "mobile", "whatsapp", "sms", "voice", "email", "slack", "discord"].map((ch) => (
                    <option key={ch} value={ch}>{ch}</option>
                  ))}
                </select>
                <Input placeholder="Channel user ID" value={bindUserId} onChange={(e) => setBindUserId(e.target.value)} />
                <Button size="sm" disabled={!token || !selectedCustomerId || busy === "bind"} onClick={() => void handleBindIdentity()}>
                  Bind identity
                </Button>
              </div>
              <div className="flex gap-2 max-w-xl">
                <Input placeholder="Secondary customer ID to merge" value={mergeSecondaryId} onChange={(e) => setMergeSecondaryId(e.target.value)} />
                <Button size="sm" variant="outline" disabled={!token || !selectedCustomerId || busy === "merge"} onClick={() => void handleMergeProfiles()}>
                  Merge
                </Button>
                <Button size="sm" variant="outline" disabled={!token || !selectedCustomerId} onClick={() => void handleRecordJourney()}>
                  Record touchpoint
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 text-xs">
                <div>
                  <p className="font-medium mb-1">Bindings ({bindings.length})</p>
                  {bindings.slice(0, 8).map((b) => (
                    <p key={b.id}>{b.channel}: {b.channelUserId} → {b.customerId.slice(0, 12)}…</p>
                  ))}
                </div>
                <div>
                  <p className="font-medium mb-1">Journey ({journey.length})</p>
                  {journey.length === 0 ? (
                    <p className="text-muted-foreground">Select a customer to view journey.</p>
                  ) : (
                    journey.map((j, i) => (
                      <p key={i}>{j.type} · {j.channel} · {formatDateTime(j.timestamp)}</p>
                    ))
                  )}
                </div>
              </div>
            </Panel>
          </Section>
        </div>
      )}
    </ConsoleShell>
  );
}
