"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Loader2, Plus, Trash2, Unplug, Zap } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleFeedback } from "../components/console-feedback";
import { RoomPicker } from "../components/room-picker";
import { Button, Input, Panel, Section } from "../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  bridgeInboundWebhookUrl,
  connectBridge,
  createBridge,
  createChannelMapping,
  deleteBridge,
  deleteChannelMapping,
  disconnectBridge,
  getBridge,
  listBridgeDeliveries,
  listBridges,
  updateBridge,
  type BridgeConfig,
  type BridgeDelivery,
  type ChannelMapping,
} from "@/lib/bridge-client";

function statusBadge(status: string) {
  const variant = status === "connected" ? "default" : status === "error" ? "destructive" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

export default function BridgesPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [bridges, setBridges] = useState<BridgeConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<ChannelMapping[]>([]);
  const [deliveries, setDeliveries] = useState<BridgeDelivery[]>([]);
  const [patchToken, setPatchToken] = useState("");
  const [patchSecret, setPatchSecret] = useState("");

  const [platform, setPlatform] = useState<"slack" | "discord">("slack");
  const [bridgeName, setBridgeName] = useState("");
  const [botToken, setBotToken] = useState("");
  const [signingSecret, setSigningSecret] = useState("");

  const [mapRoomId, setMapRoomId] = useState("");
  const [mapChannelId, setMapChannelId] = useState("");
  const [mapChannelName, setMapChannelName] = useState("");

  const loadBridges = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await listBridges(token);
      setBridges(res.bridges ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load bridges"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadBridgeDetail = useCallback(async (bridgeId: string) => {
    if (!token) return;
    try {
      const [res, deliveriesRes] = await Promise.all([
        getBridge(token, bridgeId),
        listBridgeDeliveries(token, bridgeId).catch(() => ({ deliveries: [] as BridgeDelivery[] })),
      ]);
      setMappings(res.mappings ?? []);
      setDeliveries(deliveriesRes.deliveries ?? []);
      setSelectedId(bridgeId);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load bridge detail"));
    }
  }, [token]);

  useEffect(() => {
    void loadBridges();
  }, [loadBridges]);

  async function handleCreateBridge() {
    if (!token || !bridgeName.trim()) return;
    setBusy("create");
    try {
      const created = await createBridge(token, {
        platform,
        name: bridgeName.trim(),
        token: botToken || undefined,
        signingSecret: signingSecret || undefined,
      });
      setBridgeName("");
      setBotToken("");
      setSigningSecret("");
      setNotice(`Bridge ${created.id} created.`);
      await loadBridges();
      await loadBridgeDetail(created.id);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create bridge"));
    } finally {
      setBusy(null);
    }
  }

  async function handleConnect(bridgeId: string) {
    if (!token) return;
    setBusy(`connect-${bridgeId}`);
    try {
      await connectBridge(token, bridgeId);
      setNotice("Bridge connected.");
      await loadBridges();
    } catch (err) {
      setError(messageFromUnknown(err, "Connect failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect(bridgeId: string) {
    if (!token) return;
    setBusy(`disconnect-${bridgeId}`);
    try {
      await disconnectBridge(token, bridgeId);
      setNotice("Bridge disconnected.");
      await loadBridges();
    } catch (err) {
      setError(messageFromUnknown(err, "Disconnect failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteBridge(bridgeId: string) {
    if (!token) return;
    setBusy(`delete-${bridgeId}`);
    try {
      await deleteBridge(token, bridgeId);
      if (selectedId === bridgeId) {
        setSelectedId(null);
        setMappings([]);
      }
      setNotice("Bridge deleted.");
      await loadBridges();
    } catch (err) {
      setError(messageFromUnknown(err, "Delete failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handlePatchBridge(bridgeId: string) {
    if (!token || (!patchToken.trim() && !patchSecret.trim())) return;
    setBusy("patch");
    try {
      await updateBridge(token, bridgeId, {
        token: patchToken.trim() || undefined,
        signingSecret: patchSecret.trim() || undefined,
      });
      setPatchToken("");
      setPatchSecret("");
      setNotice("Bridge secrets updated.");
      await loadBridges();
      await loadBridgeDetail(bridgeId);
    } catch (err) {
      setError(messageFromUnknown(err, "Update failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateMapping() {
    if (!token || !selectedId || !mapRoomId.trim() || !mapChannelId.trim()) return;
    setBusy("mapping");
    try {
      await createChannelMapping(token, {
        bridgeId: selectedId,
        roomId: mapRoomId.trim(),
        externalChannelId: mapChannelId.trim(),
        externalChannelName: mapChannelName || undefined,
        syncDirection: "both",
      });
      setMapChannelId("");
      setMapChannelName("");
      setNotice("Channel mapping created.");
      await loadBridgeDetail(selectedId);
    } catch (err) {
      setError(messageFromUnknown(err, "Mapping failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteMapping(mappingId: string) {
    if (!token || !selectedId) return;
    setBusy(`map-${mappingId}`);
    try {
      await deleteChannelMapping(token, mappingId);
      setNotice("Mapping removed.");
      await loadBridgeDetail(selectedId);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to remove mapping"));
    } finally {
      setBusy(null);
    }
  }

  function copyWebhook(url: string) {
    void navigator.clipboard.writeText(url);
    setNotice("Webhook URL copied.");
  }

  const selectedBridge = bridges.find((b) => b.id === selectedId) ?? null;

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Slack &amp; Discord bridges"
        description="Two-way sync: signed inbound webhooks with Slack and Discord, outbound delivery with retry and per-delivery status."
        actions={
          <>
            <Link
              href="/bridges/forms"
              className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
            >
              WhatsApp / RCS forms
            </Link>
            <Link
              href="/bridges/matrix"
              className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
            >
              Matrix federation
            </Link>
          </>
        }
      />
      <ConsoleFeedback error={error} notice={notice} />

      {!token && (
        <Panel className="p-4 text-sm text-muted-foreground">
          Admin JWT required. Copy one from <Link href="/projects" className="text-primary underline">Projects</Link>.
        </Panel>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-8">
          <Section title="Create bridge">
            <Panel className="p-4 space-y-3 max-w-xl">
              <div className="flex gap-2">
                <select className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={platform} onChange={(e) => setPlatform(e.target.value as "slack" | "discord")}>
                  <option value="slack">Slack</option>
                  <option value="discord">Discord</option>
                </select>
                <Input className="flex-1" placeholder="Bridge name" value={bridgeName} onChange={(e) => setBridgeName(e.target.value)} />
              </div>
              <Input type="password" placeholder="Bot token (optional; encrypted at rest with the server key)" value={botToken} onChange={(e) => setBotToken(e.target.value)} />
              <Input
                type="password"
                placeholder={platform === "slack" ? "Signing secret (Slack, optional)" : "Application public key (Discord, optional)"}
                value={signingSecret}
                onChange={(e) => setSigningSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Inbound webhooks are rejected (503) until a signing secret is set: Slack signs with x-slack-signature, Discord with ed25519.
              </p>
              <Button size="sm" disabled={!token || busy === "create"} onClick={() => void handleCreateBridge()}>
                {busy === "create" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                Create bridge
              </Button>
            </Panel>
          </Section>

          <Section title={`Bridges (${bridges.length})`}>
            {bridges.length === 0 ? (
              <Panel className="p-4 text-sm text-muted-foreground">No bridges configured yet.</Panel>
            ) : (
              <div className="space-y-3">
                {bridges.map((bridge) => {
                  const webhookUrl = bridgeInboundWebhookUrl(bridge.platform as "slack" | "discord", bridge.id);
                  const isSelected = selectedId === bridge.id;
                  return (
                    <Panel key={bridge.id} className={`p-4 space-y-3 ${isSelected ? "ring-1 ring-primary" : ""}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{bridge.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{bridge.id} · {bridge.platform}</p>
                          <p className="text-xs text-muted-foreground">Created {formatDateTime(bridge.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {statusBadge(bridge.status)}
                          <Button size="sm" variant="outline" onClick={() => void loadBridgeDetail(bridge.id)}>Configure</Button>
                          {bridge.status === "connected" ? (
                            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void handleDisconnect(bridge.id)}>
                              <Unplug className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void handleConnect(bridge.id)}>
                              <Zap className="h-3 w-3" />
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => void handleDeleteBridge(bridge.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <code className="flex-1 truncate rounded bg-muted/50 px-2 py-1">{webhookUrl}</code>
                        <Button size="sm" variant="ghost" onClick={() => copyWebhook(webhookUrl)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {bridge.errorMessage && (
                        <p className="text-xs text-red-600">{bridge.errorMessage}</p>
                      )}
                      {!bridge.hasSigningSecret && (
                        <p className="text-xs text-amber-600">
                          Inbound webhooks return 503 until a signing secret is set. Add one under Secrets below.
                        </p>
                      )}
                    </Panel>
                  );
                })}
              </div>
            )}
          </Section>

          {selectedBridge && (
            <Section title={`Mappings: ${selectedBridge.name}`}>
              <Panel className="p-4 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <RoomPicker token={token} value={mapRoomId} onChange={setMapRoomId} />
                  <Input placeholder="External channel ID" value={mapChannelId} onChange={(e) => setMapChannelId(e.target.value)} />
                  <Input placeholder="Channel name (optional)" value={mapChannelName} onChange={(e) => setMapChannelName(e.target.value)} />
                </div>
                <Button size="sm" disabled={!token || busy === "mapping"} onClick={() => void handleCreateMapping()}>
                  {busy === "mapping" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                  Add mapping
                </Button>
                {mappings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No channel mappings yet.</p>
                ) : (
                  mappings.map((m) => (
                    <div key={m.id} className="flex items-center justify-between border-t border-border pt-2 text-sm">
                      <span>Room <code>{m.fluxychatRoomId}</code> ↔ <code>{m.externalChannelId}</code></span>
                      <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void handleDeleteMapping(m.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </Panel>
            </Section>
          )}

          {selectedBridge && (
            <Section title={`Secrets: ${selectedBridge.name}`}>
              <Panel className="p-4 space-y-3 max-w-xl">
                <Input type="password" placeholder="New bot token (optional)" value={patchToken} onChange={(e) => setPatchToken(e.target.value)} />
                <Input
                  type="password"
                  placeholder={selectedBridge.platform === "slack" ? "New signing secret (Slack)" : "New application public key (Discord)"}
                  value={patchSecret}
                  onChange={(e) => setPatchSecret(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={!token || busy === "patch" || (!patchToken.trim() && !patchSecret.trim())}
                  onClick={() => void handlePatchBridge(selectedBridge.id)}
                >
                  {busy === "patch" ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Save secrets
                </Button>
                <p className="text-xs text-muted-foreground">
                  Secrets replace the stored value and are encrypted at rest when the server key is configured.
                </p>
              </Panel>
            </Section>
          )}

          {selectedBridge && (
            <Section title={`Deliveries: ${selectedBridge.name}`}>
              <Panel className="p-4 space-y-2">
                {deliveries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No outbound deliveries yet. Messages sent in a mapped room are queued here.
                  </p>
                ) : (
                  deliveries.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-sm">
                      <span className="truncate">
                        <code>{d.fluxychatMessageId ?? "—"}</code> → <code>{d.externalChannelId}</code>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {d.status === "delivered" ? (
                          <Badge>delivered</Badge>
                        ) : d.status === "pending" ? (
                          <Badge variant="secondary">pending</Badge>
                        ) : (
                          <Badge variant="destructive">{d.status}</Badge>
                        )}
                        <span>
                          {d.attemptCount} attempt{d.attemptCount === 1 ? "" : "s"}
                        </span>
                        {d.lastError ? <code>{d.lastError}</code> : null}
                      </span>
                    </div>
                  ))
                )}
              </Panel>
            </Section>
          )}
        </div>
      )}
    </ConsoleShell>
  );
}
