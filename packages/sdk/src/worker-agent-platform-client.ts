import type { FluxyChatClient } from "./index";
import type { AgentConfig, AgentStatus, CostSummary, DeployStage, MemoryEntry } from "./agent-platform";

export interface WorkerAgentPlatformClient {
  createAgent(input: { name: string; workspaceId?: string; config: AgentConfig }): Promise<{ id: string; name: string; status: AgentStatus; workspaceId?: string }>;
  listAgents(filter?: { workspaceId?: string; status?: AgentStatus }): Promise<Array<{ id: string; name: string; status: AgentStatus; workspaceId?: string }>>;
  getAgent(agentId: string): Promise<{ id: string; name: string; status: AgentStatus; config: AgentConfig } | null>;
  commitVersion(agentId: string, input: { version?: string; message?: string; config?: AgentConfig; parentVersion?: string }): Promise<{ version: string; commitHash: string }>;
  listVersions(agentId: string): Promise<Array<{ version: string; commitHash: string; message: string | null; author: string; createdAt: string }>>;
  deploy(agentId: string, input: { stage: DeployStage["stage"]; version: string }): Promise<DeployStage>;
  listDeploys(agentId: string): Promise<DeployStage[]>;
  upsertMemory(agentId: string, input: { key: string; value: string; userId?: string; platform?: string }): Promise<MemoryEntry>;
  listMemories(agentId: string, filter?: { userId?: string }): Promise<MemoryEntry[]>;
  recordCost(agentId: string, input: { inputTokens: number; outputTokens: number; model?: string; costCents: number }): Promise<{ id: string; costCents: number }>;
  summarizeCosts(filter?: { agentId?: string }): Promise<CostSummary[]>;
  listAbTests(): Promise<Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    results: Array<{ variantId: string; variantName: string; exposures: number; conversions: number; conversionRate: number }>;
  }>>;
  createAbTest(input: {
    name: string;
    description?: string;
    metric?: string;
    variants: Array<{ id: string; name: string; trafficPercent: number; config?: Record<string, unknown> }>;
  }): Promise<{ id: string; name: string }>;
  runAbTest(testId: string): Promise<{ id: string; results: Array<{ variantId: string; variantName: string; exposures: number; conversions: number; conversionRate: number }> }>;
}

async function headers(client: FluxyChatClient): Promise<HeadersInit> {
  await client.resolveToken?.();
  return (client as unknown as { authHeaders?: () => HeadersInit }).authHeaders?.() ?? {};
}

function base(client: FluxyChatClient): string {
  return (client as unknown as { baseUrl?: string }).baseUrl?.replace(/\/$/, "") ?? "";
}

export function createWorkerAgentPlatformClient(client: FluxyChatClient): WorkerAgentPlatformClient {
  return {
    async createAgent(input) {
      const res = await fetch(`${base(client)}/agents/platform/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`createAgent failed: ${res.status}`);
      const body = (await res.json()) as { agent: { id: string; name: string; status: AgentStatus; workspaceId?: string } };
      return body.agent;
    },
    async listAgents(filter) {
      const url = new URL(`${base(client)}/agents/platform/agents`);
      if (filter?.workspaceId) url.searchParams.set("workspaceId", filter.workspaceId);
      if (filter?.status) url.searchParams.set("status", filter.status);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listAgents failed: ${res.status}`);
      const body = (await res.json()) as { agents: Array<{ id: string; name: string; status: AgentStatus; workspaceId?: string }> };
      return body.agents;
    },
    async getAgent(agentId) {
      const res = await fetch(`${base(client)}/agents/platform/agents/${encodeURIComponent(agentId)}`, {
        headers: await headers(client),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`getAgent failed: ${res.status}`);
      const body = (await res.json()) as { agent: { id: string; name: string; status: AgentStatus; config: AgentConfig } };
      return body.agent;
    },
    async commitVersion(agentId, input) {
      const res = await fetch(`${base(client)}/agents/platform/agents/${encodeURIComponent(agentId)}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`commitVersion failed: ${res.status}`);
      const body = (await res.json()) as { version: { version: string; commitHash: string } };
      return body.version;
    },
    async listVersions(agentId) {
      const res = await fetch(`${base(client)}/agents/platform/agents/${encodeURIComponent(agentId)}/versions`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`listVersions failed: ${res.status}`);
      const body = (await res.json()) as {
        versions: Array<{ version: string; commitHash: string; message: string | null; author: string; createdAt: string }>;
      };
      return body.versions;
    },
    async deploy(agentId, input) {
      const res = await fetch(`${base(client)}/agents/platform/agents/${encodeURIComponent(agentId)}/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`deploy failed: ${res.status}`);
      const body = (await res.json()) as { deploy: DeployStage };
      return body.deploy;
    },
    async listDeploys(agentId) {
      const res = await fetch(`${base(client)}/agents/platform/agents/${encodeURIComponent(agentId)}/deploys`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`listDeploys failed: ${res.status}`);
      const body = (await res.json()) as { deploys: DeployStage[] };
      return body.deploys;
    },
    async upsertMemory(agentId, input) {
      const res = await fetch(`${base(client)}/agents/platform/agents/${encodeURIComponent(agentId)}/memories`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`upsertMemory failed: ${res.status}`);
      const body = (await res.json()) as { memory: MemoryEntry };
      return body.memory;
    },
    async listMemories(agentId, filter) {
      const url = new URL(`${base(client)}/agents/platform/agents/${encodeURIComponent(agentId)}/memories`);
      if (filter?.userId) url.searchParams.set("userId", filter.userId);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listMemories failed: ${res.status}`);
      const body = (await res.json()) as { memories: MemoryEntry[] };
      return body.memories;
    },
    async recordCost(agentId, input) {
      const res = await fetch(`${base(client)}/agents/platform/agents/${encodeURIComponent(agentId)}/costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`recordCost failed: ${res.status}`);
      const body = (await res.json()) as { entry: { id: string; costCents: number } };
      return body.entry;
    },
    async summarizeCosts(filter) {
      const url = new URL(`${base(client)}/agents/platform/costs`);
      if (filter?.agentId) url.searchParams.set("agentId", filter.agentId);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`summarizeCosts failed: ${res.status}`);
      const body = (await res.json()) as { summaries: CostSummary[] };
      return body.summaries;
    },
    async listAbTests() {
      const res = await fetch(`${base(client)}/agents/platform/ab-tests`, { headers: await headers(client) });
      if (!res.ok) throw new Error(`listAbTests failed: ${res.status}`);
      const body = (await res.json()) as {
        tests: Array<{
          id: string;
          name: string;
          description: string | null;
          status: string;
          results: Array<{ variantId: string; variantName: string; exposures: number; conversions: number; conversionRate: number }>;
        }>;
      };
      return body.tests;
    },
    async createAbTest(input) {
      const res = await fetch(`${base(client)}/agents/platform/ab-tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`createAbTest failed: ${res.status}`);
      const body = (await res.json()) as { test: { id: string; name: string } };
      return body.test;
    },
    async runAbTest(testId) {
      const res = await fetch(`${base(client)}/agents/platform/ab-tests/${encodeURIComponent(testId)}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`runAbTest failed: ${res.status}`);
      const body = (await res.json()) as {
        test: { id: string; results: Array<{ variantId: string; variantName: string; exposures: number; conversions: number; conversionRate: number }> };
      };
      return body.test;
    },
  };
}
