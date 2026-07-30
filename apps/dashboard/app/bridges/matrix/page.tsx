"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Orbit, Plus, Trash2, Unplug, Zap } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { RoomPicker } from "../../components/room-picker";
import { Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  connectMatrixBridge,
  createMatrixBridge,
  createMatrixRoomMapping,
  deleteMatrixBridge,
  deleteMatrixRoomMapping,
  disconnectMatrixBridge,
  getMatrixBridge,
  getMatrixStats,
  listMatrixBridges,
  type MatrixBridge,
  type MatrixBridgeStats,
  type MatrixRoomMapping,
} from "@/lib/matrix-bridge-client";

function statusBadge(status: string) {
  const variant = status === "connected" ? "default" : status === "error" ? "destructive" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

export default function MatrixBridgesPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [stats, setStats] = useState<MatrixBridgeStats | null>(null);
  const [bridges, setBridges] = useState<MatrixBridge[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mappings, setMappings] = useState<MatrixRoomMapping[]>([]);

  const [homeserverUrl, setHomeserverUrl] = useState("https://matrix.org");
  const [accessToken, setAccessToken] = useState("");
  const [botUserId, setBotUserId] = useState("");
  const [botDisplayName, setBotDisplayName] = useState("FluxyChat Bridge");

  const [mapRoomId, setMapRoomId] = useState("");
  const [matrixRoomId, setMatrixRoomId] = useState("");
  const [matrixSpaceId, setMatrixSpaceId] = useState("");

  const loadAll = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [statsRes, listRes] = await Promise.all([getMatrixStats(token), listMatrixBridges(token)]);
      setStats(statsRes.stats);
      setBridges(listRes.bridges ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load Matrix bridges"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadDetail = useCallback(
    async (bridgeId: string) => {
      if (!token) return;
      try {
        const res = await getMatrixBridge(token, bridgeId);
        setMappings(res.mappings ?? []);
        setSelectedId(bridgeId);
      } catch (err) {
        setError(messageFromUnknown(err, "Failed to load bridge"));
      }
    },
    [token],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleCreate() {
    if (!token || !homeserverUrl.trim()) return;
    setBusy("create");
    try {
      const created = await createMatrixBridge(token, {
        homeserverUrl: homeserverUrl.trim(),
        accessToken: accessToken.trim() || undefined,
        botUserId: botUserId.trim() || undefined,
        botDisplayName: botDisplayName.trim() || undefined,
        syncMode: "bidirectional",
      });
      setAccessToken("");
      setNotice(`Matrix bridge ${created.id} created.`);
      await loadAll();
      await loadDetail(created.id);
    } catch (err) {
      setError(messageFromUnknown(err, "Create failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleConnect(bridgeId: string) {
    if (!token) return;
    setBusy(`connect-${bridgeId}`);
    try {
      await connectMatrixBridge(token, bridgeId);
      setNotice("Bridge connected.");
      await loadAll();
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
      await disconnectMatrixBridge(token, bridgeId);
      setNotice("Bridge disconnected.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Disconnect failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(bridgeId: string) {
    if (!token) return;
    setBusy(`delete-${bridgeId}`);
    try {
      await deleteMatrixBridge(token, bridgeId);
      if (selectedId === bridgeId) {
        setSelectedId(null);
        setMappings([]);
      }
      setNotice("Bridge deleted.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Delete failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleAddMapping() {
    if (!token || !selectedId || !mapRoomId.trim() || !matrixRoomId.trim()) return;
    setBusy("mapping");
    try {
      await createMatrixRoomMapping(token, {
        bridgeId: selectedId,
        roomId: mapRoomId.trim(),
        matrixRoomId: matrixRoomId.trim(),
        matrixSpaceId: matrixSpaceId.trim() || undefined,
      });
      setMatrixRoomId("");
      setMatrixSpaceId("");
      setNotice("Room mapping added.");
      await loadDetail(selectedId);
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Mapping failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRemoveMapping(mappingId: string) {
    if (!token || !selectedId) return;
    setBusy(`map-${mappingId}`);
    try {
      await deleteMatrixRoomMapping(token, mappingId);
      setNotice("Mapping removed.");
      await loadDetail(selectedId);
    } catch (err) {
      setError(messageFromUnknown(err, "Remove mapping failed"));
    } finally {
      setBusy(null);
    }
  }

  const selectedBridge = bridges.find((b) => b.id === selectedId) ?? null;

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Matrix federation"
        description="Bridge FluxyChat rooms to Matrix homeservers for EU DMA-style interoperability."
        actions={
          <Link
            href="/bridges"
            className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            Slack &amp; Discord
          </Link>
        }
      />

      <p className="text-xs text-muted-foreground">
        Docs:{" "}
        <Link href="/docs/guides/matrix-bridge" className="font-medium underline-offset-2 hover:underline">
          Matrix bridge guide
        </Link>
      </p>

      <ConsoleFeedback error={error} notice={notice} className="mt-4" />

      {!token && (
        <Panel className="mt-4 p-4 text-sm text-muted-foreground">
          Admin JWT required — copy from <Link href="/projects" className="text-primary underline">Projects</Link>.
        </Panel>
      )}

      {stats ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">
            <Orbit className="mr-1 h-3 w-3" />
            {stats.totalBridges} bridge(s)
          </Badge>
          <Badge variant="outline">{stats.totalMappings} mapping(s)</Badge>
          {stats.byStatus.map((s) => (
            <Badge key={s.status} variant="secondary">
              {s.status}: {s.count}
            </Badge>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          <Section title="Create Matrix bridge">
            <Panel className="max-w-xl space-y-3 p-4">
              <Input placeholder="Homeserver URL" value={homeserverUrl} onChange={(e) => setHomeserverUrl(e.target.value)} />
              <Input
                type="password"
                placeholder="Bot access token"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
              <Input placeholder="Bot Matrix user ID (@bot:server)" value={botUserId} onChange={(e) => setBotUserId(e.target.value)} />
              <Input placeholder="Display name" value={botDisplayName} onChange={(e) => setBotDisplayName(e.target.value)} />
              <Button size="sm" disabled={!token || busy === "create"} onClick={() => void handleCreate()}>
                {busy === "create" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                Create bridge
              </Button>
            </Panel>
          </Section>

          <Section title={`Bridges (${bridges.length})`}>
            {bridges.length === 0 ? (
              <Panel className="p-4 text-sm text-muted-foreground">No Matrix bridges yet.</Panel>
            ) : (
              <div className="space-y-3">
                {bridges.map((bridge) => {
                  const isSelected = selectedId === bridge.id;
                  return (
                    <Panel key={bridge.id} className={`space-y-2 p-4 ${isSelected ? "ring-1 ring-primary" : ""}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{bridge.botDisplayName ?? bridge.id}</p>
                          <p className="font-mono text-xs text-muted-foreground">{bridge.homeserverUrl}</p>
                          <p className="text-xs text-muted-foreground">Created {formatDateTime(bridge.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {statusBadge(bridge.status)}
                          <Button size="sm" variant="outline" onClick={() => void loadDetail(bridge.id)}>
                            Mappings
                          </Button>
                          {bridge.status === "connected" ? (
                            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void handleDisconnect(bridge.id)}>
                              <Unplug className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void handleConnect(bridge.id)}>
                              <Zap className="h-3 w-3" />
                            </Button>
                          )}
                          <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => void handleDelete(bridge.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {bridge.errorMessage ? <p className="text-xs text-red-600">{bridge.errorMessage}</p> : null}
                    </Panel>
                  );
                })}
              </div>
            )}
          </Section>

          {selectedBridge && (
            <Section title={`Room mappings — ${selectedBridge.id}`}>
              <Panel className="space-y-3 p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <RoomPicker token={token} value={mapRoomId} onChange={setMapRoomId} />
                  <Input placeholder="Matrix room ID (!abc:matrix.org)" value={matrixRoomId} onChange={(e) => setMatrixRoomId(e.target.value)} />
                  <Input
                    className="sm:col-span-2"
                    placeholder="Matrix space ID (optional)"
                    value={matrixSpaceId}
                    onChange={(e) => setMatrixSpaceId(e.target.value)}
                  />
                </div>
                <Button size="sm" disabled={!token || busy === "mapping"} onClick={() => void handleAddMapping()}>
                  {busy === "mapping" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}
                  Add mapping
                </Button>
                {mappings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No mappings yet.</p>
                ) : (
                  mappings.map((m) => (
                    <div key={m.id} className="flex items-center justify-between border-t border-border pt-2 text-sm">
                      <span>
                        Room <code>{m.fluxychatRoomId}</code> ↔ <code>{m.matrixRoomId}</code>
                      </span>
                      <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void handleRemoveMapping(m.id)}>
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
