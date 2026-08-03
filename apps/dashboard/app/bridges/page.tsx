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
  listBridges,
  type BridgeConfig,
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

  const [platform, setPlatform] = useState<"slack" | "discord">("slack");
  const [bridgeName, setBridgeName] = useState("");
  const [botToken, setBotToken] = useState("");

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
      const res = await getBridge(token, bridgeId);
      setMappings(res.mappings ?? []);
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
      });
      setBridgeName("");
      setBotToken("");
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

  async function handleCreateMapping() {
    if (!token || !selectedId || !mapRoomId.trim() || !mapChannelId.trim()) return;
    setBusy("mapping");
    try {
      await createChannelMapping(token, {
        bridgeId: selectedId,
        roomId: mapRoomId.trim(),
        externalChannelId: mapChannelId.trim(),
        externalChannelName: mapChannelName || undefined,
        syncDirection: "bidirectional",
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
        description="Inbound webhooks sync external channel messages into FluxyChat rooms."
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
          Admin JWT required — copy one from <Link href="/projects" className="text-primary underline">Projects</Link>.
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
              <Input type="password" placeholder="Bot token (optional, stored encrypted)" value={botToken} onChange={(e) => setBotToken(e.target.value)} />
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
                    </Panel>
                  );
                })}
              </div>
            )}
          </Section>

          {selectedBridge && (
            <Section title={`Mappings — ${selectedBridge.name}`}>
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
        </div>
      )}
    </ConsoleShell>
  );
}
