"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Map, RefreshCw } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleFeedback } from "../components/console-feedback";
import { Button, Input, Panel, Section } from "../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  fetchRoomCartography,
  rebuildRoomCartography,
  type RoomCartographyMap,
} from "@/lib/cartography-client";
import { RoomCartographyMap as CartographyCanvas } from "@/components/ui/room-cartography-map";

export default function CartographyPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [map, setMap] = useState<RoomCartographyMap | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);

  const load = useCallback(
    async (rebuild = false) => {
      if (!token || !roomId.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const result = rebuild
          ? await rebuildRoomCartography(token, roomId.trim())
          : await fetchRoomCartography(token, roomId.trim(), rebuild);
        if (!result.ok || !result.map) {
          setMap(null);
          setError(result.error === "insufficient_embeddings"
            ? `Need at least 5 embedded messages (found ${result.count ?? 0}). Enable semantic search + backfill embeddings.`
            : result.error || "Cartography not available for this room");
          return;
        }
        setMap(result.map);
        setSelectedClusterId(null);
        setNotice(rebuild ? "Cartography rebuilt" : null);
      } catch (err) {
        setError(messageFromUnknown(err, "Failed to load cartography"));
      } finally {
        setLoading(false);
      }
    },
    [token, roomId],
  );

  useEffect(() => {
    if (!roomId.trim()) {
      setMap(null);
      return;
    }
    void load(false);
  }, [roomId, load]);

  const selectedCluster = useMemo(
    () => map?.clusters.find((c) => c.id === selectedClusterId) ?? null,
    [map, selectedClusterId],
  );

  const clusterMessages = useMemo(() => {
    if (!map || selectedClusterId == null) return [];
    return map.points.filter((p) => p.clusterId === selectedClusterId);
  }, [map, selectedClusterId]);

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Chat cartography"
        description="Zoom-out thematic clusters from message embeddings. Batch-built map — not live layout per keystroke."
        icon={Map}
      />

      <ConsoleFeedback error={error} notice={notice} />

      <Section title="Room map" description="Requires semantic embeddings on at least 5 messages in the room.">
        <Panel className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[240px] flex-1 space-y-1 text-sm">
              <span className="text-muted-foreground">Room ID</span>
              <Input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="room uuid" />
            </label>
            <Button
              variant="outline"
              onClick={async () => {
                setBusy(true);
                await load(true);
                setBusy(false);
              }}
              disabled={busy || !roomId.trim() || !token}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Rebuild
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Building map…
            </div>
          ) : map ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{map.messageCount} messages</Badge>
                <Badge variant="secondary">{map.clusterCount} clusters</Badge>
                <span>Built {formatDateTime(map.builtAt)}</span>
              </div>
              <CartographyCanvas
                clusters={map.clusters}
                points={map.points}
                selectedClusterId={selectedClusterId}
                onSelectCluster={setSelectedClusterId}
              />
              <p className="text-xs text-muted-foreground">
                Click a cluster blob to drill down. MVP shows zoom-out blobs only; continuous zoom is V1.
              </p>
            </>
          ) : null}
        </Panel>
      </Section>

      {selectedCluster ? (
        <Section title={`Cluster: ${selectedCluster.label}`} description={selectedCluster.sampleSnippet}>
          <Panel>
            <ul className="divide-y divide-border text-sm">
              {clusterMessages.map((point) => (
                <li key={point.messageId} className="py-2">
                  <div className="text-xs text-muted-foreground">
                    #{point.messageId} · {point.userId} · {formatDateTime(point.createdAt)}
                  </div>
                  <div>{point.preview}</div>
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
      ) : null}
    </ConsoleShell>
  );
}
