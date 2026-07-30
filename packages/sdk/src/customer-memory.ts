import type { FluxyChatClient } from "./index";

export interface CustomerMemoryNode {
  id: string;
  type: string;
  label: string;
  source?: string;
  confidence?: number;
  properties?: Record<string, unknown>;
}

export interface CustomerMemoryEdge {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  confidence?: number;
}

export interface CustomerMemoryGraph {
  customerId?: string;
  externalId?: string;
  profile?: Record<string, unknown>;
  nodes: CustomerMemoryNode[];
  edges: CustomerMemoryEdge[];
  recentEvents: Array<{ name: string; type: string; at: string; roomId?: string }>;
}

export interface CustomerMemoryClient {
  getGraph(input: { externalId?: string; customerId?: string; roomId?: string }): Promise<CustomerMemoryGraph>;
}

async function authFetch(client: FluxyChatClient, path: string): Promise<Response | null> {
  await client.resolveToken?.();
  if (!client.isAuthenticated()) return null;
  const base = (client as unknown as { baseUrl?: string }).baseUrl;
  if (!base) return null;
  const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
  const headers = (client as unknown as { authHeaders?: () => HeadersInit }).authHeaders?.();
  return fetch(url.toString(), { headers });
}

export function createCustomerMemoryClient(client: FluxyChatClient): CustomerMemoryClient {
  return {
    async getGraph(input) {
      const nodes: CustomerMemoryNode[] = [];
      const edges: CustomerMemoryEdge[] = [];
      const recentEvents: CustomerMemoryGraph["recentEvents"] = [];
      let profile: Record<string, unknown> | undefined;

      if (input.customerId) {
        const cdpRes = await authFetch(client, `/api/cdp/customers/${encodeURIComponent(input.customerId)}`);
        if (cdpRes?.ok) {
          const customer = (await cdpRes.json()) as Record<string, unknown>;
          profile = customer;
          nodes.push({
            id: String(customer.id ?? input.customerId),
            type: "customer",
            label: String(customer.name ?? customer.external_id ?? input.customerId),
            source: "cdp",
          });
        }
      }

      if (input.externalId && !profile) {
        const listRes = await authFetch(
          client,
          `/api/cdp/customers?search=${encodeURIComponent(input.externalId)}&limit=1`,
        );
        if (listRes?.ok) {
          const body = (await listRes.json()) as { customers?: Array<Record<string, unknown>> };
          const customer = body.customers?.[0];
          if (customer) {
            profile = customer;
            nodes.push({
              id: String(customer.id),
              type: "customer",
              label: String(customer.name ?? customer.external_id ?? input.externalId),
              source: "cdp",
            });
          }
        }
      }

      const customerId = input.customerId ?? (profile?.id ? String(profile.id) : undefined);
      if (customerId) {
        const evRes = await authFetch(
          client,
          `/api/cdp/events?customerId=${encodeURIComponent(customerId)}&limit=20`,
        );
        if (evRes?.ok) {
          const evBody = (await evRes.json()) as { events?: Array<Record<string, unknown>> };
          for (const ev of evBody.events ?? []) {
            recentEvents.push({
              name: String(ev.event_name ?? "event"),
              type: String(ev.event_type ?? "track"),
              at: String(ev.created_at ?? ""),
              roomId: ev.room_id ? String(ev.room_id) : undefined,
            });
          }
        }
      }

      if (input.roomId) {
        const kgRes = await authFetch(client, `/rooms/${encodeURIComponent(input.roomId)}/kg`);
        if (kgRes?.ok) {
          const kg = (await kgRes.json()) as {
            nodes?: Array<Record<string, unknown>>;
            edges?: Array<Record<string, unknown>>;
          };
          for (const n of kg.nodes ?? []) {
            nodes.push({
              id: String(n.id),
              type: String(n.node_type ?? "concept"),
              label: String(n.label ?? n.id),
              source: "knowledge_graph",
              confidence: typeof n.confidence === "number" ? n.confidence : undefined,
            });
          }
          for (const e of kg.edges ?? []) {
            edges.push({
              id: String(e.id),
              type: String(e.edge_type ?? "linked_to"),
              sourceId: String(e.source_node_id),
              targetId: String(e.target_node_id),
              confidence: typeof e.confidence === "number" ? e.confidence : undefined,
            });
          }
        }
      }

      return { customerId, externalId: input.externalId, profile, nodes, edges, recentEvents };
    },
  };
}
