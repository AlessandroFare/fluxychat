import type { GraphEdge, GraphNode } from "reagraph";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

export interface KgNodeRecord {
  id: string;
  nodeType: string;
  label: string;
  properties?: Record<string, unknown> | null;
  sourceMessageId?: number | null;
  confidence?: number;
  validFrom?: string;
  validTo?: string | null;
}

export interface KgEdgeRecord {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  edgeType: string;
  properties?: Record<string, unknown> | null;
  sourceMessageId?: number | null;
  confidence?: number;
}

export interface RoomGraphResponse {
  ok?: boolean;
  nodes: KgNodeRecord[];
  edges: KgEdgeRecord[];
  stats?: {
    totalNodes: number;
    totalEdges: number;
    nodeTypeCounts: Record<string, number>;
    edgeTypeCounts: Record<string, number>;
  };
  error?: string;
}

export interface GraphExtractResponse {
  nodesExtracted: number;
  edgesExtracted: number;
  nodesInserted: number;
  edgesInserted: number;
  error?: string;
}

const NODE_COLORS: Record<string, string> = {
  user: "#3b82f6",
  task: "#f59e0b",
  decision: "#10b981",
  concept: "#8b5cf6",
  external_entity: "#ec4899",
  file: "#64748b",
  message: "#06b6d4",
  thread: "#14b8a6",
  action: "#ef4444",
  room: "#6366f1",
};

export function kgNodeColor(nodeType: string): string {
  return NODE_COLORS[nodeType] ?? "#6366f1";
}

export function mapRoomGraphToReagraph(graph: RoomGraphResponse): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const nodes: GraphNode[] = graph.nodes.map((n) => ({
    id: n.id,
    label: n.label,
    subLabel: n.nodeType,
    fill: kgNodeColor(n.nodeType),
    size: 8 + Math.min(6, (n.confidence ?? 0.5) * 6),
    data: n,
    cluster: n.nodeType,
  }));

  const edges: GraphEdge[] = graph.edges
    .filter((e) => nodeIds.has(e.sourceNodeId) && nodeIds.has(e.targetNodeId))
    .map((e) => ({
      id: e.id,
      source: e.sourceNodeId,
      target: e.targetNodeId,
      label: e.edgeType.replace(/_/g, " "),
      fill: "#94a3b8",
      size: 1,
      data: e,
    }));

  return { nodes, edges };
}

export function kgErrorMessage(code: string | undefined): string {
  const normalized = code?.trim().split(/\s|\(/)[0];
  switch (normalized) {
    case "knowledge_graph_disabled":
      return "Knowledge graph is disabled. Set KNOWLEDGE_GRAPH_ENABLED=true on the Worker.";
    case "ai_not_configured":
      return "LLM is not configured. Add AI provider credentials to the Worker.";
    case "llm_not_allowed":
      return "LLM processing is not allowed for this tenant.";
    case "ai_provider_failed":
      return "LLM provider failed during extraction. Check Worker logs.";
    default:
      return code ? `Request failed (${code})` : "Request failed";
  }
}

export async function fetchRoomGraph(
  roomId: string,
  memberJwt: string,
  limit = 80,
): Promise<RoomGraphResponse> {
  const base = getPublicWorkerUrl().replace(/\/$/, "");
  return fetchWorkerJson<RoomGraphResponse>(
    `${base}/rooms/${encodeURIComponent(roomId)}/kg?limit=${limit}`,
    { headers: { Authorization: `Bearer ${memberJwt}` } },
  );
}

export async function extractRoomGraph(
  roomId: string,
  memberJwt: string,
): Promise<GraphExtractResponse> {
  const base = getPublicWorkerUrl().replace(/\/$/, "");
  return fetchWorkerJson<GraphExtractResponse>(
    `${base}/rooms/${encodeURIComponent(roomId)}/kg/extract`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${memberJwt}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );
}
