"use client";

import { useEffect, useMemo, useRef } from "react";
import { GraphCanvas, darkTheme, lightTheme, type GraphCanvasRef, type InternalGraphNode } from "reagraph";
import type { GraphEdge, GraphNode } from "reagraph";
import { useTheme } from "@/app/components/theme-provider";

interface RoomKnowledgeGraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelectNode: (node: KgNodeSelection | null) => void;
}

export interface KgNodeSelection {
  id: string;
  label: string;
  nodeType: string;
  sourceMessageId?: number | null;
  confidence?: number;
  properties?: Record<string, unknown> | null;
}

export function RoomKnowledgeGraphCanvas({
  nodes,
  edges,
  selectedId,
  onSelectNode,
}: RoomKnowledgeGraphCanvasProps) {
  const { resolvedTheme } = useTheme();
  const graphRef = useRef<GraphCanvasRef>(null);
  const theme = resolvedTheme === "dark" ? darkTheme : lightTheme;

  const selections = useMemo(() => (selectedId ? [selectedId] : []), [selectedId]);

  useEffect(() => {
    if (nodes.length && graphRef.current) {
      graphRef.current.centerGraph(undefined, { animated: true });
    }
  }, [nodes.length, edges.length]);

  function handleNodeClick(node: InternalGraphNode) {
    const data = node.data as KgNodeSelection | undefined;
    onSelectNode(
      data
        ? data
        : {
            id: node.id,
            label: node.label ?? node.id,
            nodeType: node.subLabel ?? "unknown",
          },
    );
  }

  if (!nodes.length) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed bg-muted/20 text-sm text-muted-foreground">
        No graph nodes yet. Extract from recent messages to populate the graph.
      </div>
    );
  }

  return (
    <div className="h-[360px] overflow-hidden rounded-lg border bg-background">
      <GraphCanvas
        ref={graphRef}
        theme={theme}
        layoutType="forceDirected2d"
        nodes={nodes}
        edges={edges}
        selections={selections}
        labelType="all"
        edgeInterpolation="curved"
        edgeArrowPosition="end"
        draggable
        onNodeClick={handleNodeClick}
        onCanvasClick={() => onSelectNode(null)}
      />
    </div>
  );
}
