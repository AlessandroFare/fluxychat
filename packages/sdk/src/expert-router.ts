export type SkillLevel = "beginner" | "intermediate" | "expert";
export type RoutePriority = "low" | "normal" | "high" | "urgent";

export interface AgentProfile {
  id: string;
  name: string;
  skills: string[];
  skillLevels: Record<string, SkillLevel>;
  maxConcurrentChats: number;
  activeChats: number;
  isAvailable: boolean;
  languages: string[];
  slaSeconds?: number;
}

export interface RoutingRequest {
  userId: string;
  requiredSkills?: string[];
  priority: RoutePriority;
  language?: string;
  context?: Record<string, unknown>;
}

export interface RoutingResult {
  agentId: string;
  agentName: string;
  score: number;
  estimatedWaitMs: number;
  slaDeadline?: number;
}

export interface SlaPolicy {
  priority: RoutePriority;
  targetSeconds: number;
  escalationAction?: string;
}

export interface ExpertRouter {
  registerAgent(profile: AgentProfile): void;
  updateAgent(id: string, updates: Partial<AgentProfile>): void;
  unregisterAgent(id: string): boolean;
  getAgent(id: string): AgentProfile | undefined;
  findBestAgent(request: RoutingRequest): RoutingResult | undefined;
  setSlaPolicies(policies: SlaPolicy[]): void;
  getSlaStatus(): Array<{ agentId: string; violations: number; avgResponseMs: number }>;
}

export function createExpertRouter(): ExpertRouter {
  const agents = new Map<string, AgentProfile>();
  const slaPolicies: SlaPolicy[] = [];

  function scoreAgent(agent: AgentProfile, request: RoutingRequest): number {
    if (!agent.isAvailable || agent.activeChats >= agent.maxConcurrentChats) return 0;
    let score = 100;

    if (request.requiredSkills) {
      const hasSkills = request.requiredSkills.every(
        (s) => agent.skills.includes(s) && agent.skillLevels[s] !== "beginner",
      );
      if (!hasSkills) return 0;
      const expertCount = request.requiredSkills.filter(
        (s) => agent.skillLevels[s] === "expert",
      ).length;
      score += expertCount * 20;
    }

    if (request.language && agent.languages.includes(request.language)) {
      score += 15;
    }

    const loadRatio = agent.activeChats / agent.maxConcurrentChats;
    score -= loadRatio * 30;

    const priorityBonus = { low: 0, normal: 10, high: 25, urgent: 50 };
    score += priorityBonus[request.priority];

    return Math.max(0, score);
  }

  return {
    registerAgent(profile) {
      agents.set(profile.id, { ...profile });
    },

    updateAgent(id, updates) {
      const agent = agents.get(id);
      if (agent) Object.assign(agent, updates);
    },

    unregisterAgent(id) {
      return agents.delete(id);
    },

    getAgent(id) {
      return agents.get(id);
    },

    findBestAgent(request) {
      const scored = Array.from(agents.values())
        .map((a) => ({ agent: a, score: scoreAgent(a, request) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scored.length === 0) return undefined;

      const best = scored[0];
      const slaPolicy = slaPolicies.find((p) => p.priority === request.priority);
      return {
        agentId: best.agent.id,
        agentName: best.agent.name,
        score: best.score,
        estimatedWaitMs: best.agent.activeChats * 30000,
        slaDeadline: slaPolicy ? Date.now() + slaPolicy.targetSeconds * 1000 : undefined,
      };
    },

    setSlaPolicies(policies) {
      slaPolicies.length = 0;
      slaPolicies.push(...policies);
    },

    getSlaStatus() {
      return Array.from(agents.values()).map((a) => ({
        agentId: a.id,
        violations: 0,
        avgResponseMs: a.activeChats > 0 ? 15000 : 0,
      }));
    },
  };
}
