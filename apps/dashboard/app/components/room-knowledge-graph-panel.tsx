"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GitBranch, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button, Section } from "./ui";
import {
  extractRoomGraph,
  fetchRoomGraph,
  kgErrorMessage,
  mapRoomGraphToReagraph,
  type KgNodeRecord,
  type RoomGraphResponse,
} from "@/lib/knowledge-graph-client";
import { messageFromUnknown } from "@/lib/error-message";
import type { KgNodeSelection } from "@/components/knowledge-graph/room-knowledge-graph-canvas";

const RoomKnowledgeGraphCanvas = dynamic(
  () =>
    import("@/components/knowledge-graph/room-knowledge-graph-canvas").then(
      (m) => m.RoomKnowledgeGraphCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[360px] items-center justify-center rounded-lg border text-sm text-muted-foreground">
        Loading graph canvas…
      </div>
    ),
  },
);

interface RoomKnowledgeGraphPanelProps {
  roomId: string;
  memberJwt: string;
}

export function RoomKnowledgeGraphPanel({ roomId, memberJwt }: RoomKnowledgeGraphPanelProps) {
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graph, setGraph] = useState<RoomGraphResponse | null>(null);
  const [selected, setSelected] = useState<KgNodeSelection | null>(null);
  const [lastExtract, setLastExtract] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!memberJwt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRoomGraph(roomId, memberJwt);
      if ((data as { error?: string }).error && !data.nodes?.length) {
        setError(kgErrorMessage((data as { error?: string }).error));
        setGraph({ nodes: [], edges: [] });
        return;
      }
      setGraph(data);
    } catch (err) {
      setError(kgErrorMessage(messageFromUnknown(err, "")) || messageFromUnknown(err, "Failed to load knowledge graph"));
    } finally {
      setLoading(false);
    }
  }, [memberJwt, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function extract() {
    if (!memberJwt.trim()) return;
    setExtracting(true);
    setError(null);
    try {
      const result = await extractRoomGraph(roomId, memberJwt);
      if ((result as { error?: string }).error) {
        setError(kgErrorMessage((result as { error?: string }).error));
        return;
      }
      setLastExtract(
        `Extracted ${result.nodesExtracted} nodes, ${result.edgesExtracted} edges. Persisted ${result.nodesInserted} new nodes, ${result.edgesInserted} new edges.`,
      );
      await load();
    } catch (err) {
      const msg = messageFromUnknown(err, "");
      setError(kgErrorMessage(msg) || messageFromUnknown(err, "Graph extraction failed"));
    } finally {
      setExtracting(false);
    }
  }

  const reagraph = useMemo(
    () => mapRoomGraphToReagraph(graph ?? { nodes: [], edges: [] }),
    [graph],
  );

  const stats = graph?.stats;

  return (
    <Section
      title="Live knowledge graph"
      description="Incremental LLM extraction of entities and relations from the room timeline (PH-130). Rendered with reagraph (WebGL)."
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={loading || extracting} onClick={() => void load()}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Refresh
        </Button>
        <Button type="button" size="sm" disabled={loading || extracting} onClick={() => void extract()}>
          {extracting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
          Extract from messages
        </Button>
      </div>

      {stats ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5" />
          <span>
            {stats.totalNodes} nodes · {stats.totalEdges} edges
          </span>
          {Object.entries(stats.nodeTypeCounts).map(([type, count]) => (
            <Badge key={type} variant="secondary" className="text-[10px]">
              {type}: {count}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="mt-3">
        <RoomKnowledgeGraphCanvas
          nodes={reagraph.nodes}
          edges={reagraph.edges}
          selectedId={selected?.id ?? null}
          onSelectNode={setSelected}
        />
      </div>

      {selected ? <NodeDetail node={selected} allNodes={graph?.nodes ?? []} /> : null}

      {lastExtract ? <p className="mt-2 text-xs text-muted-foreground">{lastExtract}</p> : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      <p className="mt-3 text-xs text-muted-foreground">
        Requires <code className="text-[10px]">KNOWLEDGE_GRAPH_ENABLED=true</code> and a configured LLM provider.
        Nodes link to source messages for audit. Opt out via tenant AI policy.
      </p>
    </Section>
  );
}

function NodeDetail({ node, allNodes }: { node: KgNodeSelection; allNodes: KgNodeRecord[] }) {
  const full = allNodes.find((n) => n.id === node.id);
  return (
    <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-sm">
      <p className="font-medium">{node.label}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Type: {node.nodeType}
        {node.confidence != null ? ` · confidence ${Math.round(node.confidence * 100)}%` : null}
        {node.sourceMessageId ? ` · message #${node.sourceMessageId}` : null}
      </p>
      {full?.properties && Object.keys(full.properties).length ? (
        <pre className="mt-2 max-h-24 overflow-auto rounded bg-background p-2 font-mono text-[10px]">
          {JSON.stringify(full.properties, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
