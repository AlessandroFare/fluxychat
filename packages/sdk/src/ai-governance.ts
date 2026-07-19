export type RiskTier = "low" | "medium" | "high" | "critical";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "requires_review";

export interface ModelRegistryEntry {
  modelId: string;
  provider: string;
  version: string;
  riskTier: RiskTier;
  allowedUseCases: string[];
  approvedBy: string;
  approvedAt: string;
  expiresAt?: string;
}

export interface PromptEntry {
  promptId: string;
  template: string;
  riskTier: RiskTier;
  allowedModels: string[];
  requiredApprovals: string[];
  status: ApprovalStatus;
}

export interface ToolRegistryEntry {
  toolId: string;
  name: string;
  riskTier: RiskTier;
  allowedRoles: string[];
  requiresApproval: boolean;
  rateLimit: number;
}

export interface EvaluationResult {
  evaluationId: string;
  targetId: string;
  targetType: "model" | "prompt" | "tool";
  score: number;
  passed: boolean;
  evidence: string;
  evaluatedAt: string;
}

export interface GovernanceConfig {
  autoApproveTiers: RiskTier[];
  requireEvidence: boolean;
  maxRetentionDays: number;
}

export interface AiGovernance {
  registerModel(entry: Omit<ModelRegistryEntry, "approvedAt">): ModelRegistryEntry;
  registerPrompt(entry: Omit<PromptEntry, "status">): PromptEntry;
  registerTool(entry: ToolRegistryEntry): ToolRegistryEntry;
  approveModel(modelId: string, approver: string): ModelRegistryEntry;
  getModel(modelId: string): ModelRegistryEntry | null;
  getPrompt(promptId: string): PromptEntry | null;
  getTool(toolId: string): ToolRegistryEntry | null;
  listModels(riskTier?: RiskTier): ModelRegistryEntry[];
  listPrompts(): PromptEntry[];
  listTools(): ToolRegistryEntry[];
  listEvaluations(targetId?: string): EvaluationResult[];
}

export function createAiGovernance(config: Partial<GovernanceConfig> = {}): AiGovernance {
  const models = new Map<string, ModelRegistryEntry>();
  const prompts = new Map<string, PromptEntry>();
  const tools = new Map<string, ToolRegistryEntry>();
  const evaluations: EvaluationResult[] = [];
  const cfg: GovernanceConfig = { autoApproveTiers: ["low", "medium"], requireEvidence: true, maxRetentionDays: 365, ...config };

  return {
    registerModel(entry: Omit<ModelRegistryEntry, "approvedAt">): ModelRegistryEntry {
      const full: ModelRegistryEntry = { ...entry, approvedAt: new Date().toISOString() };
      models.set(entry.modelId, full);
      return full;
    },

    registerPrompt(entry: Omit<PromptEntry, "status">): PromptEntry {
      const status: ApprovalStatus = cfg.autoApproveTiers.includes(entry.riskTier) ? "approved" : "pending";
      const full: PromptEntry = { ...entry, status };
      prompts.set(entry.promptId, full);
      return full;
    },

    registerTool(entry: ToolRegistryEntry): ToolRegistryEntry {
      tools.set(entry.toolId, entry);
      return entry;
    },

    approveModel(modelId: string, approver: string): ModelRegistryEntry {
      const model = models.get(modelId);
      if (!model) throw new Error(`Model ${modelId} not found.`);
      model.approvedBy = approver;
      model.approvedAt = new Date().toISOString();
      return model;
    },

    getModel(modelId: string) { return models.get(modelId) ?? null; },
    getPrompt(promptId: string) { return prompts.get(promptId) ?? null; },
    getTool(toolId: string) { return tools.get(toolId) ?? null; },

    listModels(riskTier?: RiskTier) {
      const all = [...models.values()];
      return riskTier ? all.filter((m) => m.riskTier === riskTier) : all;
    },

    listPrompts() { return [...prompts.values()]; },
    listTools() { return [...tools.values()]; },
    listEvaluations(targetId?: string) {
      return targetId ? evaluations.filter((e) => e.targetId === targetId) : [...evaluations];
    },
  };
}
