import type { FluxyChatClient } from "./index";
import { createCustomerMemoryClient, type CustomerMemoryGraph } from "./customer-memory";

export interface AgentMemoryEntry {
  key: string;
  value: unknown;
  score?: number;
  updatedAt?: string;
}

export interface AgentMemoryProvider {
  remember(key: string, value: unknown): Promise<void>;
  recall(key: string): Promise<unknown | null>;
  search(query: string, limit?: number): Promise<AgentMemoryEntry[]>;
  list?(limit?: number): Promise<AgentMemoryEntry[]>;
}

export function createInMemoryAgentMemoryProvider(): AgentMemoryProvider {
  const store = new Map<string, AgentMemoryEntry>();

  return {
    async remember(key, value) {
      store.set(key, { key, value, updatedAt: new Date().toISOString() });
    },
    async recall(key) {
      return store.get(key)?.value ?? null;
    },
    async search(query, limit = 10) {
      const q = query.trim().toLowerCase();
      if (!q) return [...store.values()].slice(0, limit);
      return [...store.values()]
        .filter((e) => e.key.toLowerCase().includes(q) || JSON.stringify(e.value).toLowerCase().includes(q))
        .slice(0, limit);
    },
    async list(limit = 50) {
      return [...store.values()].slice(0, limit);
    },
  };
}

export function createProjectMemoryProvider(
  client: FluxyChatClient,
  options: { roomId?: string; externalId?: string; customerId?: string },
): AgentMemoryProvider {
  const memoryClient = createCustomerMemoryClient(client);

  async function loadGraph(): Promise<CustomerMemoryGraph> {
    return memoryClient.getGraph({
      roomId: options.roomId,
      externalId: options.externalId,
      customerId: options.customerId,
    });
  }

  return {
    async remember(key, value) {
      const graph = await loadGraph();
      graph.nodes.push({
        id: `mem_${key}`,
        type: "memory",
        label: key,
        source: "agent",
        properties: { value },
      });
    },
    async recall(key) {
      const graph = await loadGraph();
      const node = graph.nodes.find((n) => n.type === "memory" && n.label === key);
      return node?.properties?.value ?? null;
    },
    async search(query, limit = 10) {
      const graph = await loadGraph();
      const q = query.trim().toLowerCase();
      return graph.nodes
        .filter((n) => !q || n.label.toLowerCase().includes(q))
        .slice(0, limit)
        .map((n) => ({
          key: n.label,
          value: n.properties?.value,
          score: n.confidence,
        }));
    },
  };
}

export interface Mem0AgentMemoryConfig {
  apiKey: string;
  baseUrl?: string;
  userId: string;
  agentId?: string;
}

/** Mem0-compatible HTTP memory provider (project-scoped via userId). */
export function createMem0AgentMemoryProvider(config: Mem0AgentMemoryConfig): AgentMemoryProvider {
  const base = (config.baseUrl ?? "https://api.mem0.ai/v1").replace(/\/$/, "");
  const headers = {
    Authorization: `Token ${config.apiKey}`,
    "Content-Type": "application/json",
  };

  return {
    async remember(key, value) {
      await fetch(`${base}/memories/`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [{ role: "user", content: `${key}: ${JSON.stringify(value)}` }],
          user_id: config.userId,
          agent_id: config.agentId,
        }),
      });
    },
    async recall(key) {
      const res = await fetch(`${base}/memories/search/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: key, user_id: config.userId, limit: 1 }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { results?: Array<{ memory?: string }> };
      return body.results?.[0]?.memory ?? null;
    },
    async search(query, limit = 10) {
      const res = await fetch(`${base}/memories/search/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, user_id: config.userId, limit }),
      });
      if (!res.ok) return [];
      const body = (await res.json()) as { results?: Array<{ memory?: string; score?: number }> };
      return (body.results ?? []).map((r, i) => ({
        key: `mem0_${i}`,
        value: r.memory,
        score: r.score,
      }));
    },
  };
}
