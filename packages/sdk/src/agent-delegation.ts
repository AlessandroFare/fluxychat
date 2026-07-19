import { type AgentCard, type AgentCapability, type AgentCommunicationBus, type AgentMessage, type AgentTask, FLUXY_AGENT_PROTOCOL_VERSION } from "./agent-to-agent";

export interface RoutingPolicy {
  maxResults?: number;
  requireCapabilities?: string[];
  preferCapabilities?: string[];
  excludeAgentIds?: string[];
  minTrust?: AgentCard["trust"];
  maxCost?: AgentCard["costTier"];
  regions?: string[];
  requireInputMode?: string;
  requireOutputMode?: string;
}

export interface RoutedAgent {
  card: AgentCard;
  score: number;
  matchReasons: string[];
}

function scoreCard(card: AgentCard, policy: RoutingPolicy): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (policy.requireCapabilities) {
    const hasAll = policy.requireCapabilities.every((req) => card.capabilities.some((c) => c.id === req));
    if (!hasAll) return { score: -1, reasons: ["missing required capabilities"] };
    reasons.push("matches required capabilities");
    score += 100;
  }

  if (policy.preferCapabilities) {
    const matchCount = policy.preferCapabilities.filter((pref) => card.capabilities.some((c) => c.id === pref)).length;
    if (matchCount > 0) {
      score += matchCount * 10;
      reasons.push(`matches ${matchCount} preferred capabilities`);
    }
  }

  if (policy.requireInputMode && card.capabilities.some((c) => c.inputModes?.includes(policy.requireInputMode!))) {
    score += 20;
    reasons.push("matches input mode");
  }

  if (policy.requireOutputMode && card.capabilities.some((c) => c.outputModes?.includes(policy.requireOutputMode!))) {
    score += 20;
    reasons.push("matches output mode");
  }

  if (policy.regions) {
    if (card.regions?.some((r) => policy.regions!.includes(r))) {
      score += 15;
      reasons.push("matches region");
    } else {
      score -= 10;
    }
  }

  if (policy.minTrust) {
    const trustOrder: Record<string, number> = { unverified: 0, verified: 1, internal: 2 };
    if ((trustOrder[card.trust ?? "unverified"] ?? 0) < (trustOrder[policy.minTrust] ?? 0)) {
      return { score: -1, reasons: ["trust level too low"] };
    }
    score += 10;
  }

  if (policy.maxCost) {
    const costOrder: Record<string, number> = { free: 0, low: 1, standard: 2, premium: 3 };
    if ((costOrder[card.costTier ?? "standard"] ?? 0) > (costOrder[policy.maxCost] ?? 2)) {
      return { score: -1, reasons: ["over max cost tier"] };
    }
  }

  if (card.trust === "internal") score += 25;
  if (card.costTier === "free") score += 5;

  return { score, reasons };
}

export function routeTask(cards: AgentCard[], policy: RoutingPolicy): RoutedAgent[] {
  const scored: RoutedAgent[] = [];
  const maxResults = policy.maxResults ?? 1;

  for (const card of cards) {
    if (policy.excludeAgentIds?.includes(card.agentId)) continue;
    const { score, reasons } = scoreCard(card, policy);
    if (score >= 0) scored.push({ card, score, matchReasons: reasons });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

export interface SharedAgentState {
  key: string;
  roomId: string;
  value: unknown;
  owner: string;
  version: number;
  updatedAt: string;
  ttlMs?: number;
}

export interface SharedStateStore {
  set(key: string, roomId: string, value: unknown, owner: string, opts?: { ttlMs?: number }): Promise<SharedAgentState>;
  get(key: string, roomId: string): Promise<SharedAgentState | null>;
  delete(key: string, roomId: string, owner: string): Promise<boolean>;
  list(roomId: string): Promise<SharedAgentState[]>;
  lock(key: string, roomId: string, owner: string, ttlMs?: number): Promise<boolean>;
  unlock(key: string, roomId: string, owner: string): Promise<void>;
}

export function createMemorySharedStateStore(): SharedStateStore {
  const states = new Map<string, SharedAgentState>();
  const locks = new Map<string, string>();

  function mapKey(key: string, roomId: string) { return `${roomId}:${key}`; }

  return {
    async set(key, roomId, value, owner, opts) {
      const k = mapKey(key, roomId);
      const current = states.get(k);
      const state: SharedAgentState = {
        key, roomId, value, owner,
        version: (current?.version ?? 0) + 1,
        updatedAt: new Date().toISOString(),
        ttlMs: opts?.ttlMs,
      };
      states.set(k, state);
      return state;
    },
    async get(key, roomId) {
      const state = states.get(mapKey(key, roomId));
      if (!state) return null;
      if (state.ttlMs && Date.now() - new Date(state.updatedAt).getTime() > state.ttlMs) {
        states.delete(mapKey(key, roomId));
        return null;
      }
      return state;
    },
    async delete(key, roomId, owner) {
      const k = mapKey(key, roomId);
      const state = states.get(k);
      if (!state) return false;
      if (state.owner !== owner) return false;
      states.delete(k);
      return true;
    },
    async list(roomId) {
      return [...states.values()].filter((s) => s.roomId === roomId);
    },
    async lock(key, roomId, owner, ttlMs = 30_000) {
      const k = mapKey(key, roomId);
      const existing = locks.get(k);
      if (existing && existing !== owner) {
        return false;
      }
      locks.set(k, owner);
      setTimeout(() => { if (locks.get(k) === owner) locks.delete(k); }, ttlMs);
      return true;
    },
    async unlock(key, roomId, owner) {
      const k = mapKey(key, roomId);
      if (locks.get(k) === owner) locks.delete(k);
    },
  };
}

export interface HandoffRequest {
  id: string;
  roomId: string;
  projectId: string;
  from: { type: "agent" | "human"; id: string };
  to: { type: "agent" | "human"; id: string };
  reason: string;
  context: string;
  status: "pending" | "accepted" | "rejected" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface HandoffOptions {
  bus: AgentCommunicationBus;
  createId?: () => string;
  now?: () => Date;
}

export function createHandoffManager(options: HandoffOptions) {
  const { bus } = options;
  const createId = options.createId ?? (() => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const now = options.now ?? (() => new Date());
  const handoffs = new Map<string, HandoffRequest>();
  const pendingHumanHandoffs = new Map<string, HandoffRequest[]>();

  return {
    async requestHandoff(params: {
      roomId: string;
      projectId: string;
      fromAgentId: string;
      toHumanId: string;
      reason: string;
      context?: string;
    }): Promise<HandoffRequest> {
      const request: HandoffRequest = {
        id: createId(),
        roomId: params.roomId,
        projectId: params.projectId,
        from: { type: "agent", id: params.fromAgentId },
        to: { type: "human", id: params.toHumanId },
        reason: params.reason,
        context: params.context ?? "",
        status: "pending",
        createdAt: now().toISOString(),
        updatedAt: now().toISOString(),
      };
      handoffs.set(request.id, request);
      const key = `${params.roomId}:${params.toHumanId}`;
      const existing = pendingHumanHandoffs.get(key) ?? [];
      existing.push(request);
      pendingHumanHandoffs.set(key, existing);
      await bus.send({
        fromAgentId: params.fromAgentId,
        toAgentId: params.toHumanId,
        roomId: params.roomId,
        projectId: params.projectId,
        type: "status",
        content: `HANDOFF:${request.id}:${params.reason}`,
        metadata: { handoffId: request.id, handoffReason: params.reason, handoffContext: params.context },
      });
      return request;
    },

    async respondToHandoff(handoffId: string, agentId: string, accept: boolean, note?: string): Promise<HandoffRequest> {
      const req = handoffs.get(handoffId);
      if (!req) throw new Error(`Unknown handoff: ${handoffId}`);
      if (req.status !== "pending") throw new Error(`Handoff ${handoffId} is already ${req.status}`);
      req.status = accept ? "accepted" : "rejected";
      req.updatedAt = now().toISOString();
      const key = `${req.roomId}:${req.to.id}`;
      const list = pendingHumanHandoffs.get(key);
      if (list) {
        pendingHumanHandoffs.set(key, list.filter((h) => h.id !== handoffId));
      }
      await bus.send({
        fromAgentId: agentId,
        toAgentId: req.from.id,
        roomId: req.roomId,
        projectId: req.projectId,
        type: "status",
        content: `HANDOFF_${accept ? "ACCEPTED" : "REJECTED"}:${handoffId}${note ? `:${note}` : ""}`,
        metadata: { handoffId, accepted: accept, note },
      });
      return req;
    },

    completeHandoff(handoffId: string): HandoffRequest | null {
      const req = handoffs.get(handoffId);
      if (!req || req.status !== "accepted") return null;
      req.status = "completed";
      req.updatedAt = now().toISOString();
      return req;
    },

    getPendingForHuman(roomId: string, humanId: string): HandoffRequest[] {
      return pendingHumanHandoffs.get(`${roomId}:${humanId}`) ?? [];
    },

    getHandoff(handoffId: string): HandoffRequest | null {
      return handoffs.get(handoffId) ?? null;
    },

    listHandoffs(roomId: string): HandoffRequest[] {
      return [...handoffs.values()].filter((h) => h.roomId === roomId);
    },
  };
}

export type { AgentCommunicationBus, AgentCard, AgentCapability, AgentTask };
