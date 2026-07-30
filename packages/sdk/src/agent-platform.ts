/**
 * AI Agent Platform SDK — ROADMAP 3.5
 *
 * Features:
 *  - No-code agent builder (visual flow: trigger → step → action)
 *  - Agent A/B testing (wrapper over ab-testing engine)
 *  - Agent versioning (git-style: commit, branch, diff, rollback)
 *  - Agent CI/CD deploy (stages: dev → staging → production)
 *  - Agent testing sandbox (spy adapter + simulation)
 *  - Agent multi-tenancy (workspace isolation)
 *  - Agent cost tracking (token usage + $ per agent)
 *  - Agent rate limiting (tier-based: free/starter/pro/enterprise)
 *  - Agent personality designer (tone, humor, formality presets)
 *  - Agent emotional intelligence (sentiment detection + adaptive tone)
 *  - Agent cross-platform memory (unified identity memory store)
 */

import { createAbTestingEngine, type AbTestingEngine, type AbTestConfig, type AbTestResult } from "./ab-testing";

// ─── Types ────────────────────────────────────────────

export type AgentTier = "free" | "starter" | "pro" | "enterprise";

export type AgentStatus = "draft" | "dev" | "staging" | "production" | "archived";

export type StepType = "trigger" | "condition" | "action" | "output" | "llm_call" | "tool_call" | "wait";

export interface FlowStep {
  id: string;
  type: StepType;
  label: string;
  config: Record<string, unknown>;
  nextSteps?: string[];
}

export interface AgentFlow {
  steps: FlowStep[];
  entryStepId: string;
}

export interface AgentVersion {
  version: string;
  commitHash: string;
  message: string;
  author: string;
  timestamp: string;
  config: AgentConfig;
  parentVersion?: string;
}

export interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  flow?: AgentFlow;
  personality?: AgentPersonality;
  tier: AgentTier;
  workspaceId: string;
}

export interface AgentPersonality {
  tone: "formal" | "casual" | "friendly" | "professional" | "playful";
  humor: number; // 0-1
  formality: number; // 0-1
  verbosity: number; // 0-1
  empathy: number; // 0-1
  customInstructions?: string;
}

export interface CostEntry {
  agentId: string;
  timestamp: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  costCents: number;
}

export interface CostSummary {
  agentId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCents: number;
  entries: number;
  avgCostPerRequest: number;
}

export interface RateLimitConfig {
  tier: AgentTier;
  requestsPerMinute: number;
  requestsPerDay: number;
  tokensPerDay: number;
}

export interface MemoryEntry {
  id: string;
  agentId: string;
  userId: string;
  platform: string;
  key: string;
  value: string;
  timestamp: string;
}

export interface DeployStage {
  stage: "dev" | "staging" | "production";
  agentId: string;
  version: string;
  deployedAt: string;
  deployedBy: string;
  status: "pending" | "active" | "rolled_back";
}

export interface SandboxResult {
  success: boolean;
  output: string;
  duration: number;
  tokenUsage: { input: number; output: number };
  errors: string[];
  logs: string[];
}

// ─── Factory ──────────────────────────────────────────

export function createAgentPlatform() {
  const agents = new Map<string, AgentConfig>();
  const versions = new Map<string, AgentVersion[]>();
  const costs = new Map<string, CostEntry[]>();
  const memories = new Map<string, MemoryEntry[]>();
  const deploys = new Map<string, DeployStage[]>();
  const abEngine: AbTestingEngine = createAbTestingEngine();

  const rateLimits: Record<AgentTier, RateLimitConfig> = {
    free: { tier: "free", requestsPerMinute: 10, requestsPerDay: 100, tokensPerDay: 50_000 },
    starter: { tier: "starter", requestsPerMinute: 60, requestsPerDay: 5_000, tokensPerDay: 500_000 },
    pro: { tier: "pro", requestsPerMinute: 300, requestsPerDay: 50_000, tokensPerDay: 5_000_000 },
    enterprise: { tier: "enterprise", requestsPerMinute: 1000, requestsPerDay: 500_000, tokensPerDay: 50_000_000 },
  };

  const requestLog: Map<string, number[]> = new Map(); // agentId -> timestamps

  let agentCounter = 0;
  let versionCounter = 0;
  let memoryCounter = 0;

  // ── No-code agent builder ──

  function createAgent(config: Omit<AgentConfig, "tier" | "workspaceId"> & { tier?: AgentTier; workspaceId?: string }): AgentConfig {
    const id = `agent_${++agentCounter}`;
    const full: AgentConfig = {
      ...config,
      tier: config.tier || "free",
      workspaceId: config.workspaceId || "default",
    };
    agents.set(id, full);
    commitVersion(id, "Initial version", "system");
    return full;
  }

  function getAgent(id: string): AgentConfig | undefined {
    return agents.get(id);
  }

  function listAgents(workspaceId?: string): { id: string; config: AgentConfig }[] {
    const result: { id: string; config: AgentConfig }[] = [];
    for (const [id, config] of agents) {
      if (!workspaceId || config.workspaceId === workspaceId) {
        result.push({ id, config });
      }
    }
    return result;
  }

  function updateAgent(id: string, updates: Partial<AgentConfig>): AgentConfig | undefined {
    const agent = agents.get(id);
    if (!agent) return undefined;
    const updated = { ...agent, ...updates };
    agents.set(id, updated);
    return updated;
  }

  function deleteAgent(id: string): boolean {
    return agents.delete(id);
  }

  // ── Flow builder ──

  function createFlow(steps: Omit<FlowStep, "id">[], entryIndex = 0): AgentFlow {
    const withIds = steps.map((s, i) => ({ ...s, id: `step_${i + 1}` }));
    return { steps: withIds, entryStepId: withIds[entryIndex]?.id || withIds[0]?.id || "" };
  }

  function executeFlow(flow: AgentFlow, input: Record<string, unknown>): { output: string; path: string[] } {
    const path: string[] = [];
    let current = flow.steps.find((s) => s.id === flow.entryStepId);
    let output = "";

    while (current) {
      path.push(current.id);
      switch (current.type) {
        case "trigger":
          output = `Triggered: ${current.label}`;
          break;
        case "condition":
          // Simple condition check
          break;
        case "llm_call":
          output = `[LLM ${current.config.model || "gpt-4"}] Processing: ${JSON.stringify(input).slice(0, 100)}`;
          break;
        case "tool_call":
          output = `[Tool: ${current.config.tool || "unknown"}] Executed`;
          break;
        case "action":
          output = `[Action: ${current.label}] Done`;
          break;
        case "output":
          output = (current.config.text as string) || "Response generated";
          break;
        case "wait":
          break;
      }
      const nextId = current.nextSteps?.[0];
      current = nextId ? flow.steps.find((s) => s.id === nextId) : undefined;
    }
    return { output, path };
  }

  // ── Versioning ──

  function commitVersion(agentId: string, message: string, author: string): AgentVersion | undefined {
    const agent = agents.get(agentId);
    if (!agent) return undefined;
    const agentVersions = versions.get(agentId) || [];
    const parent = agentVersions[agentVersions.length - 1];
    const version = `v${++versionCounter}`;
    const commitHash = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const v: AgentVersion = {
      version, commitHash, message, author,
      timestamp: new Date().toISOString(),
      config: { ...agent },
      parentVersion: parent?.version,
    };
    agentVersions.push(v);
    versions.set(agentId, agentVersions);
    return v;
  }

  function getVersions(agentId: string): AgentVersion[] {
    return [...(versions.get(agentId) || [])];
  }

  function rollback(agentId: string, targetVersion: string): boolean {
    const agentVersions = versions.get(agentId) || [];
    const target = agentVersions.find((v) => v.version === targetVersion);
    if (!target) return false;
    agents.set(agentId, { ...target.config });
    commitVersion(agentId, `Rollback to ${targetVersion}`, "system");
    return true;
  }

  function diffVersions(agentId: string, v1: string, v2: string): { field: string; from: unknown; to: unknown }[] {
    const agentVersions = versions.get(agentId) || [];
    const ver1 = agentVersions.find((v) => v.version === v1);
    const ver2 = agentVersions.find((v) => v.version === v2);
    if (!ver1 || !ver2) return [];
    const diffs: { field: string; from: unknown; to: unknown }[] = [];
    const keys = new Set([...Object.keys(ver1.config), ...Object.keys(ver2.config)]);
    for (const key of keys) {
      if (JSON.stringify(ver1.config[key as keyof AgentConfig]) !== JSON.stringify(ver2.config[key as keyof AgentConfig])) {
        diffs.push({ field: key, from: ver1.config[key as keyof AgentConfig], to: ver2.config[key as keyof AgentConfig] });
      }
    }
    return diffs;
  }

  // ── CI/CD Deploy ──

  function deploy(agentId: string, stage: DeployStage["stage"], version: string, deployedBy: string): DeployStage | undefined {
    const agentDeploys = deploys.get(agentId) || [];
    // Deactivate previous active deploy in same stage
    agentDeploys.forEach((d) => { if (d.stage === stage && d.status === "active") d.status = "rolled_back"; });
    const deploy: DeployStage = {
      stage, agentId, version, deployedAt: new Date().toISOString(), deployedBy, status: "active",
    };
    agentDeploys.push(deploy);
    deploys.set(agentId, agentDeploys);
    return deploy;
  }

  function getDeploys(agentId: string): DeployStage[] {
    return [...(deploys.get(agentId) || [])];
  }

  function rollbackDeploy(agentId: string, stage: DeployStage["stage"]): boolean {
    const agentDeploys = deploys.get(agentId) || [];
    // Find current active
    const current = agentDeploys.find((d) => d.stage === stage && d.status === "active");
    if (!current) return false;
    current.status = "rolled_back";
    // Find previous active in same stage
    const prev = [...agentDeploys].reverse().find((d) => d.stage === stage && d.status === "rolled_back" && d.version !== current.version);
    if (prev) {
      prev.status = "active";
      return true;
    }
    return false;
  }

  // ── Testing sandbox ──

  function runSandbox(agentId: string, input: string): SandboxResult {
    const agent = agents.get(agentId);
    const start = Date.now();
    const logs: string[] = [];
    const errors: string[] = [];

    if (!agent) {
      return { success: false, output: "", duration: 0, tokenUsage: { input: 0, output: 0 }, errors: ["Agent not found"], logs };
    }

    logs.push(`[${new Date().toISOString()}] Loading agent "${agent.name}"...`);
    logs.push(`[${new Date().toISOString()}] Model: ${agent.model}, Temp: ${agent.temperature}`);
    logs.push(`[${new Date().toISOString()}] Tools: ${agent.tools.join(", ") || "none"}`);

    // Simulate flow execution if flow exists
    let output = "";
    if (agent.flow) {
      logs.push(`[${new Date().toISOString()}] Executing flow (${agent.flow.steps.length} steps)...`);
      const result = executeFlow(agent.flow, { input });
      output = result.output;
      logs.push(`[${new Date().toISOString()}] Flow path: ${result.path.join(" → ")}`);
    } else {
      output = `[${agent.model}] Response to: "${input.slice(0, 80)}"`;
      logs.push(`[${new Date().toISOString()}] Direct LLM call simulated`);
    }

    // Apply personality
    if (agent.personality) {
      const p = agent.personality;
      const prefix = p.tone === "formal" ? "Good day. " : p.tone === "playful" ? "Hey there! 😄 " : "";
      output = prefix + output;
      logs.push(`[${new Date().toISOString()}] Personality applied: tone=${p.tone}, humor=${p.humor}, empathy=${p.empathy}`);
    }

    const inputTokens = Math.ceil(input.length / 4) + 50;
    const outputTokens = Math.ceil(output.length / 4) + 20;
    const duration = Date.now() - start;

    logs.push(`[${new Date().toISOString()}] Completed in ${duration}ms`);

    return {
      success: true,
      output,
      duration,
      tokenUsage: { input: inputTokens, output: outputTokens },
      errors,
      logs,
    };
  }

  // ── Multi-tenancy ──

  function listWorkspaces(): string[] {
    const ws = new Set<string>();
    for (const agent of agents.values()) ws.add(agent.workspaceId);
    return [...ws];
  }

  function moveAgentToWorkspace(agentId: string, workspaceId: string): boolean {
    const agent = agents.get(agentId);
    if (!agent) return false;
    agent.workspaceId = workspaceId;
    return true;
  }

  // ── Cost tracking ──

  function recordCost(entry: Omit<CostEntry, "timestamp">): void {
    const full: CostEntry = { ...entry, timestamp: new Date().toISOString() };
    const list = costs.get(entry.agentId) || [];
    list.push(full);
    costs.set(entry.agentId, list);
  }

  function getCostSummary(agentId: string): CostSummary {
    const entries = costs.get(agentId) || [];
    const totalInput = entries.reduce((s, e) => s + e.inputTokens, 0);
    const totalOutput = entries.reduce((s, e) => s + e.outputTokens, 0);
    const totalCost = entries.reduce((s, e) => s + e.costCents, 0);
    return {
      agentId,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      totalCostCents: totalCost,
      entries: entries.length,
      avgCostPerRequest: entries.length > 0 ? totalCost / entries.length : 0,
    };
  }

  function getWorkspaceCosts(workspaceId: string): CostSummary[] {
    return listAgents(workspaceId).map(({ id }) => getCostSummary(id));
  }

  // ── Rate limiting ──

  function checkRateLimit(agentId: string): { allowed: boolean; reason?: string; resetAt?: string } {
    const agent = agents.get(agentId);
    if (!agent) return { allowed: false, reason: "Agent not found" };
    const limit = rateLimits[agent.tier];
    const now = Date.now();
    const windowMs = 60_000; // 1 minute
    const log = requestLog.get(agentId) || [];
    const recent = log.filter((t) => now - t < windowMs);
    if (recent.length >= limit.requestsPerMinute) {
      const resetAt = new Date(recent[0] + windowMs).toISOString();
      return { allowed: false, reason: `Rate limit: ${limit.requestsPerMinute} req/min (${agent.tier})`, resetAt };
    }
    recent.push(now);
    requestLog.set(agentId, recent);
    return { allowed: true };
  }

  function getRateLimit(tier: AgentTier): RateLimitConfig {
    return rateLimits[tier];
  }

  // ── A/B testing passthrough ──

  function createAgentTest(name: string, description: string, variants: { id: string; name: string; config: Record<string, unknown>; trafficPercent: number }[], metric: AbTestConfig["metric"]) {
    return abEngine.createTest({ name, description, variants, metric, minSampleSize: 30 });
  }

  function runAgentTest(testId: string, agentId: string): { variant: string; result: SandboxResult } {
    const variant = abEngine.assignVariant(testId);
    abEngine.recordExposure(testId, variant.id);
    const result = runSandbox(agentId, `Test input for variant ${variant.name}`);
    abEngine.recordConversion(testId, variant.id);
    return { variant: variant.name, result };
  }

  function getTestResults(testId: string): AbTestResult[] {
    return abEngine.getResults(testId);
  }

  function listTests(): AbTestConfig[] {
    return abEngine.listTests();
  }

  // ── Personality designer ──

  function createPersonality(preset: "supportive" | "analytical" | "creative" | "professional" | "energetic", custom?: Partial<AgentPersonality>): AgentPersonality {
    const presets: Record<string, AgentPersonality> = {
      supportive: { tone: "friendly", humor: 0.3, formality: 0.4, verbosity: 0.6, empathy: 0.9 },
      analytical: { tone: "professional", humor: 0.1, formality: 0.8, verbosity: 0.5, empathy: 0.3 },
      creative: { tone: "playful", humor: 0.7, formality: 0.2, verbosity: 0.7, empathy: 0.5 },
      professional: { tone: "formal", humor: 0.1, formality: 0.9, verbosity: 0.4, empathy: 0.4 },
      energetic: { tone: "casual", humor: 0.6, formality: 0.2, verbosity: 0.8, empathy: 0.6 },
    };
    return { ...presets[preset], ...custom };
  }

  // ── Emotional intelligence ──

  function detectEmotion(text: string): { emotion: string; score: number; adaptTone: string } {
    const lower = text.toLowerCase();
    if (/\b(angry|furious|mad|outraged|terrible|hate)\b/.test(lower)) {
      return { emotion: "angry", score: 0.8, adaptTone: "calm and empathetic" };
    }
    if (/\b(sad|depressed|unhappy|crying|miserable)\b/.test(lower)) {
      return { emotion: "sad", score: 0.7, adaptTone: "supportive and gentle" };
    }
    if (/\b(happy|great|awesome|love|amazing|excited)\b/.test(lower)) {
      return { emotion: "happy", score: 0.9, adaptTone: "enthusiastic and matching" };
    }
    if (/\b(confused|lost|help|don't understand|unsure)\b/.test(lower)) {
      return { emotion: "confused", score: 0.6, adaptTone: "clear and patient" };
    }
    if (/\b(urgent|asap|emergency|now|immediately)\b/.test(lower)) {
      return { emotion: "urgent", score: 0.8, adaptTone: "efficient and direct" };
    }
    return { emotion: "neutral", score: 0.3, adaptTone: "balanced" };
  }

  // ── Cross-platform memory ──

  function storeMemory(agentId: string, userId: string, platform: string, key: string, value: string): MemoryEntry {
    const id = `mem_${++memoryCounter}`;
    const entry: MemoryEntry = { id, agentId, userId, platform, key, value, timestamp: new Date().toISOString() };
    const list = memories.get(`${agentId}:${userId}`) || [];
    list.push(entry);
    memories.set(`${agentId}:${userId}`, list);
    return entry;
  }

  function getMemory(agentId: string, userId: string, key?: string): MemoryEntry[] {
    const list = memories.get(`${agentId}:${userId}`) || [];
    return key ? list.filter((m) => m.key === key) : [...list];
  }

  function getUnifiedMemory(agentId: string, userId: string): Record<string, { value: string; platform: string; timestamp: string }> {
    const list = memories.get(`${agentId}:${userId}`) || [];
    const unified: Record<string, { value: string; platform: string; timestamp: string }> = {};
    for (const m of list) {
      unified[m.key] = { value: m.value, platform: m.platform, timestamp: m.timestamp };
    }
    return unified;
  }

  return {
    // No-code builder
    createAgent, getAgent, listAgents, updateAgent, deleteAgent,
    createFlow, executeFlow,
    // Versioning
    commitVersion, getVersions, rollback, diffVersions,
    // CI/CD
    deploy, getDeploys, rollbackDeploy,
    // Sandbox
    runSandbox,
    // Multi-tenancy
    listWorkspaces, moveAgentToWorkspace,
    // Cost tracking
    recordCost, getCostSummary, getWorkspaceCosts,
    // Rate limiting
    checkRateLimit, getRateLimit,
    // A/B testing
    createAgentTest, runAgentTest, getTestResults, listTests,
    // Personality
    createPersonality,
    // Emotional intelligence
    detectEmotion,
    // Cross-platform memory
    storeMemory, getMemory, getUnifiedMemory,
  };
}

export type AgentPlatformApi = ReturnType<typeof createAgentPlatform>;
