export type AgentDebateStepStatus = "running" | "completed" | "failed";

export type AgentDebateParticipantRole = "debate" | "moderator";

export interface AgentDebateStep {
  id: string;
  sessionId: string;
  agentId: string;
  roleName: string;
  participantRole: AgentDebateParticipantRole;
  round: number;
  content: string;
  status: AgentDebateStepStatus;
}

export interface AgentDebateSession {
  id: string;
  projectId: string;
  roomId: string;
  prompt: string;
  status: string;
  maxRounds: number;
  currentRound: number;
  steps: AgentDebateStep[];
  synthesisContent: string | null;
  latencyMs: number | null;
  createdAt: string;
  completedAt: string | null;
}

/**
 * Merge incoming debate step updates (running → completed) preserving order.
 */
export function mergeDebateSteps(
  existing: AgentDebateStep[],
  incoming: AgentDebateStep,
): AgentDebateStep[] {
  const idx = existing.findIndex((s) => s.id === incoming.id);
  if (idx === -1) return [...existing, incoming];
  const next = existing.slice();
  next[idx] = incoming;
  return next;
}

export function isDebateSessionLive(steps: AgentDebateStep[]): boolean {
  return steps.some((s) => s.status === "running");
}

export function debateStepsByRound(steps: AgentDebateStep[]): Map<number, AgentDebateStep[]> {
  const map = new Map<number, AgentDebateStep[]>();
  for (const step of steps) {
    if (step.participantRole !== "debate") continue;
    const list = map.get(step.round) ?? [];
    list.push(step);
    map.set(step.round, list);
  }
  return map;
}
