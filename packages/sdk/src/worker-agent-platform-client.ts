import type { FluxyChatClient } from "./index";
import type { AgentConfig, AgentStatus, DeployStage, MemoryEntry } from "./agent-platform";

export interface WorkerAgentPlatformClient {
  createAgent(input: { name: string; workspaceId?: string; config: AgentConfig }): Promise<{ id: string; name: string; status: AgentStatus }>;
  listAgents(filter?: { workspaceId?: string; status?: AgentStatus }): Promise<Array<{ id: string; name: string; status: AgentStatus }>>;
  getAgent(agentId: string): Promise<{ id: string; name: string; status: AgentStatus; config: AgentConfig } | null>;
  commitVersion(agentId: string, input: { version?: string; message?: string; config?: AgentConfig; parentVersion?: string }): Promise<{ version: string; commitHash: string }>;
  deploy(agentId: string, input: { stage: DeployStage["stage"]; version: string }): Promise<DeployStage>;
  upsertMemory(agentId: string, input: { key: string; value: string; userId?: string; platform?: string }): Promise<MemoryEntry>;
  listMemories(agentId: string, filter?: { userId?: string }): Promise<MemoryEntry[]>;
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
      const body = (await res.json()) as { agent: { id: string; name: string; status: AgentStatus } };
      return body.agent;
    },
    async listAgents(filter) {
      const url = new URL(`${base(client)}/agents/platform/agents`);
      if (filter?.workspaceId) url.searchParams.set("workspaceId", filter.workspaceId);
      if (filter?.status) url.searchParams.set("status", filter.status);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listAgents failed: ${res.status}`);
      const body = (await res.json()) as { agents: Array<{ id: string; name: string; status: AgentStatus }> };
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
  };
}
