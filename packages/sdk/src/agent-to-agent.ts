export const FLUXY_AGENT_PROTOCOL_VERSION = "fluxy.agent.v1" as const;

export type AgentTaskStatus = "submitted" | "working" | "input-required" | "completed" | "failed" | "cancelled";
export type AgentMessageType = "delegation" | "query" | "response" | "broadcast" | "status" | "artifact" | "cancel";

export interface AgentCapability {
  id: string;
  description?: string;
  inputModes?: string[];
  outputModes?: string[];
  extensions?: Record<string, unknown>;
}

export interface AgentCard {
  version: typeof FLUXY_AGENT_PROTOCOL_VERSION;
  agentId: string;
  name: string;
  description?: string;
  endpoint?: string;
  capabilities: AgentCapability[];
  trust?: "unverified" | "verified" | "internal";
  regions?: string[];
  costTier?: "free" | "low" | "standard" | "premium";
  expiresAt?: string;
  extensions?: Record<string, unknown>;
}

export interface AgentArtifact {
  id: string;
  name?: string;
  mediaType: string;
  data?: unknown;
  uri?: string;
  createdBy: string;
  createdAt: string;
  extensions?: Record<string, unknown>;
}

export interface AgentTask {
  version: typeof FLUXY_AGENT_PROTOCOL_VERSION;
  id: string;
  roomId: string;
  projectId: string;
  fromAgentId: string;
  toAgentId: string;
  status: AgentTaskStatus;
  input: string;
  idempotencyKey: string;
  offset: number;
  depth: number;
  parentTaskId?: string;
  artifacts: AgentArtifact[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface AgentMessage {
  version: typeof FLUXY_AGENT_PROTOCOL_VERSION;
  id: string;
  fromAgentId: string;
  toAgentId: string;
  roomId: string;
  projectId: string;
  type: AgentMessageType;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  offset: number;
  taskId?: string;
  parentMessageId?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  ttlMs?: number;
}

export interface AgentMessageHandler {
  handle(message: AgentMessage): Promise<string | null>;
}

export interface AgentCommunicationBus {
  send(message: Omit<AgentMessage, "version" | "id" | "timestamp" | "offset">): Promise<string>;
  broadcast(roomId: string, projectId: string, content: string, fromAgentId: string): Promise<void>;
  registerHandler(agentId: string, handler: AgentMessageHandler): void;
  unregisterHandler(agentId: string): void;
  getHistory(roomId: string, limit?: number, afterOffset?: number): Promise<AgentMessage[]>;
  registerCard(card: AgentCard): void;
  discover(capability?: string): AgentCard[];
  submitTask(input: Omit<AgentTask, "version" | "id" | "status" | "offset" | "artifacts" | "createdAt" | "updatedAt">): Promise<AgentTask>;
  updateTask(taskId: string, status: AgentTaskStatus, update?: { artifact?: AgentArtifact; error?: string }): AgentTask;
  getTask(taskId: string): AgentTask | null;
  cancelTask(taskId: string): AgentTask;
}

export interface AgentBusOptions {
  maxHistory?: number;
  maxDelegationDepth?: number;
  now?: () => Date;
  createId?: () => string;
}

function defaultId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function assertText(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new TypeError(`${name} is required.`);
  return trimmed;
}

export function createAgentCommunicationBus(options: AgentBusOptions = {}): AgentCommunicationBus {
  const handlers = new Map<string, AgentMessageHandler>();
  const cards = new Map<string, AgentCard>();
  const tasks = new Map<string, AgentTask>();
  const idempotency = new Map<string, string>();
  const history: AgentMessage[] = [];
  const maxHistory = Math.max(1, options.maxHistory ?? 10_000);
  const maxDepth = Math.max(0, options.maxDelegationDepth ?? 8);
  const now = () => (options.now ?? (() => new Date()))().toISOString();
  const createId = options.createId ?? defaultId;
  let offset = 0;

  const bus: AgentCommunicationBus = {
    async send(input) {
      assertText(input.fromAgentId, "fromAgentId");
      assertText(input.toAgentId, "toAgentId");
      assertText(input.roomId, "roomId");
      const message: AgentMessage = {
        ...input,
        version: FLUXY_AGENT_PROTOCOL_VERSION,
        id: createId(),
        timestamp: now(),
        offset: ++offset,
      };
      history.push(message);
      if (history.length > maxHistory) history.splice(0, history.length - maxHistory);
      const handler = handlers.get(message.toAgentId);
      if (handler) await handler.handle(message);
      return message.id;
    },
    async broadcast(roomId, projectId, content, fromAgentId) {
      const recipients = [...handlers.keys()].filter((id) => id !== fromAgentId);
      await Promise.all(recipients.map((toAgentId) => bus.send({
        fromAgentId,
        toAgentId,
        roomId,
        projectId,
        type: "broadcast",
        content,
      })));
    },
    registerHandler(agentId, handler) {
      handlers.set(assertText(agentId, "agentId"), handler);
    },
    unregisterHandler(agentId) {
      handlers.delete(agentId);
    },
    async getHistory(roomId, limit = 100, afterOffset = 0) {
      return history.filter((item) => item.roomId === roomId && item.offset > afterOffset).slice(-Math.max(0, limit));
    },
    registerCard(card) {
      if (card.version !== FLUXY_AGENT_PROTOCOL_VERSION) throw new TypeError("Unsupported agent card version.");
      cards.set(assertText(card.agentId, "agentId"), structuredClone(card));
    },
    discover(capability) {
      const current = Date.now();
      return [...cards.values()].filter((card) => {
        if (card.expiresAt && Date.parse(card.expiresAt) <= current) return false;
        return !capability || card.capabilities.some((item) => item.id === capability);
      }).map((card) => structuredClone(card));
    },
    async submitTask(input) {
      const existingId = idempotency.get(input.idempotencyKey);
      if (existingId) return structuredClone(tasks.get(existingId)!);
      if (input.depth > maxDepth) throw new Error(`Delegation depth exceeds ${maxDepth}.`);
      const timestamp = now();
      const task: AgentTask = {
        ...input,
        version: FLUXY_AGENT_PROTOCOL_VERSION,
        id: createId(),
        status: "submitted",
        offset: ++offset,
        artifacts: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      tasks.set(task.id, task);
      idempotency.set(task.idempotencyKey, task.id);
      await bus.send({
        fromAgentId: task.fromAgentId,
        toAgentId: task.toAgentId,
        roomId: task.roomId,
        projectId: task.projectId,
        type: "delegation",
        content: task.input,
        taskId: task.id,
        metadata: task.metadata,
      });
      return structuredClone(task);
    },
    updateTask(taskId, status, update = {}) {
      const task = tasks.get(taskId);
      if (!task) throw new Error(`Unknown agent task: ${taskId}`);
      if (["completed", "failed", "cancelled"].includes(task.status)) throw new Error(`Agent task ${taskId} is terminal.`);
      const next: AgentTask = {
        ...task,
        status,
        offset: ++offset,
        updatedAt: now(),
        artifacts: update.artifact ? [...task.artifacts, update.artifact] : task.artifacts,
        ...(update.error ? { error: update.error } : {}),
      };
      tasks.set(taskId, next);
      return structuredClone(next);
    },
    getTask(taskId) {
      const task = tasks.get(taskId);
      return task ? structuredClone(task) : null;
    },
    cancelTask(taskId) {
      return bus.updateTask(taskId, "cancelled");
    },
  };
  return bus;
}

export function delegateToAgent(
  bus: AgentCommunicationBus,
  fromAgentId: string,
  toAgentId: string,
  roomId: string,
  projectId: string,
  task: string,
  options: { priority?: AgentMessage["priority"]; ttlMs?: number; metadata?: Record<string, unknown>; parentTaskId?: string; depth?: number; idempotencyKey?: string } = {},
): Promise<AgentTask> {
  return bus.submitTask({
    fromAgentId,
    toAgentId,
    roomId,
    projectId,
    input: assertText(task, "task"),
    idempotencyKey: options.idempotencyKey ?? `${fromAgentId}:${toAgentId}:${roomId}:${task}`,
    depth: options.depth ?? 0,
    parentTaskId: options.parentTaskId,
    metadata: {
      ...options.metadata,
      ...(options.priority ? { priority: options.priority } : {}),
      ...(options.ttlMs !== undefined ? { ttlMs: options.ttlMs } : {}),
    },
  });
}

export interface AGUIEvent {
  type: string;
  runId?: string;
  messageId?: string;
  taskId?: string;
  data?: unknown;
  extensions?: Record<string, unknown>;
}

/** Lossless boundary adapter: known fields are normalized and unknown fields remain in extensions. */
export function agentMessageToAGUI(message: AgentMessage): AGUIEvent {
  const type = message.type === "status" ? "RUN_STATUS" : message.type === "artifact" ? "STATE_DELTA" : "CUSTOM";
  return {
    type,
    messageId: message.id,
    taskId: message.taskId,
    data: message,
    extensions: { fluxyOffset: message.offset, fluxyType: message.type },
  };
}

export function agentTaskToA2A(task: AgentTask): Record<string, unknown> {
  return {
    id: task.id,
    contextId: task.roomId,
    status: { state: task.status, timestamp: task.updatedAt },
    artifacts: task.artifacts,
    metadata: { ...task.metadata, fluxyVersion: task.version, fluxyOffset: task.offset },
  };
}
