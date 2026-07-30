import type { FluxyChatClient } from "./index";
import type { AgentArtifact, AgentTask, AgentTaskStatus } from "./agent-to-agent";

export interface WorkerAgentTaskClient {
  submit(input: {
    roomId: string;
    fromAgentId: string;
    toAgentId: string;
    input: string;
    idempotencyKey: string;
    depth?: number;
    parentTaskId?: string;
    metadata?: Record<string, unknown>;
    resumeAt?: string;
  }): Promise<{ task: AgentTask; deduplicated?: boolean }>;
  update(
    taskId: string,
    status: AgentTaskStatus,
    update?: { artifact?: AgentArtifact; error?: string; resumeAt?: string },
  ): Promise<AgentTask>;
  get(taskId: string): Promise<AgentTask | null>;
  list(filter?: { roomId?: string; status?: AgentTaskStatus; toAgentId?: string; limit?: number }): Promise<AgentTask[]>;
}

function mapWorkerTask(row: Record<string, unknown>): AgentTask {
  return {
    version: "fluxy.agent.v1",
    id: String(row.id),
    roomId: String(row.roomId),
    projectId: String(row.projectId),
    fromAgentId: String(row.fromAgentId),
    toAgentId: String(row.toAgentId),
    status: row.status as AgentTaskStatus,
    input: String(row.input),
    idempotencyKey: String(row.idempotencyKey),
    offset: Number(row.offset ?? 0),
    depth: Number(row.depth ?? 0),
    parentTaskId: row.parentTaskId ? String(row.parentTaskId) : undefined,
    artifacts: Array.isArray(row.artifacts) ? (row.artifacts as AgentTask["artifacts"]) : [],
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    error: row.error ? String(row.error) : undefined,
  };
}

export function createWorkerAgentTaskClient(client: FluxyChatClient): WorkerAgentTaskClient {
  async function headers(): Promise<HeadersInit | undefined> {
    await client.resolveToken?.();
    return (client as unknown as { authHeaders?: () => HeadersInit }).authHeaders?.();
  }

  const base = () => (client as unknown as { baseUrl?: string }).baseUrl ?? "";

  return {
    async submit(input) {
      const res = await fetch(`${base()}/agents/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers()) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`submitAgentTask failed: ${res.status}`);
      const body = (await res.json()) as { task: Record<string, unknown>; deduplicated?: boolean };
      return { task: mapWorkerTask(body.task), deduplicated: body.deduplicated };
    },
    async update(taskId, status, update) {
      const res = await fetch(`${base()}/agents/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await headers()) },
        body: JSON.stringify({ status, ...update }),
      });
      if (!res.ok) throw new Error(`updateAgentTask failed: ${res.status}`);
      const body = (await res.json()) as { task: Record<string, unknown> };
      return mapWorkerTask(body.task);
    },
    async get(taskId) {
      const res = await fetch(`${base()}/agents/tasks/${encodeURIComponent(taskId)}`, {
        headers: await headers(),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`getAgentTask failed: ${res.status}`);
      const body = (await res.json()) as { task: Record<string, unknown> };
      return mapWorkerTask(body.task);
    },
    async list(filter = {}) {
      const url = new URL(`${base()}/agents/tasks`);
      if (filter.roomId) url.searchParams.set("roomId", filter.roomId);
      if (filter.status) url.searchParams.set("status", filter.status);
      if (filter.toAgentId) url.searchParams.set("toAgentId", filter.toAgentId);
      if (filter.limit) url.searchParams.set("limit", String(filter.limit));
      const res = await fetch(url.toString(), { headers: await headers() });
      if (!res.ok) throw new Error(`listAgentTasks failed: ${res.status}`);
      const body = (await res.json()) as { tasks?: Array<Record<string, unknown>> };
      return (body.tasks ?? []).map(mapWorkerTask);
    },
  };
}
