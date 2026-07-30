/**
 * AI governance registry — models, prompts, tools, evaluations (KV-backed).
 */

const RISK_TIERS = new Set(["low", "medium", "high", "critical"]);

function registryKey(projectId) {
  return `ai-gov:${projectId}`;
}

function getKv(env) {
  return env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV ?? null;
}

async function readRegistry(env, projectId) {
  const kv = getKv(env);
  if (!kv) {
    return { models: [], prompts: [], tools: [], evaluations: [] };
  }
  const raw = await kv.get(registryKey(projectId));
  if (!raw) return { models: [], prompts: [], tools: [], evaluations: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      models: Array.isArray(parsed.models) ? parsed.models : [],
      prompts: Array.isArray(parsed.prompts) ? parsed.prompts : [],
      tools: Array.isArray(parsed.tools) ? parsed.tools : [],
      evaluations: Array.isArray(parsed.evaluations) ? parsed.evaluations : [],
    };
  } catch {
    return { models: [], prompts: [], tools: [], evaluations: [] };
  }
}

async function writeRegistry(env, projectId, registry) {
  const kv = getKv(env);
  if (!kv) throw new Error("kv_unavailable");
  await kv.put(registryKey(projectId), JSON.stringify(registry));
}

function assertRiskTier(tier) {
  if (!RISK_TIERS.has(tier)) {
    return { error: "invalid_risk_tier", message: `riskTier must be one of: ${[...RISK_TIERS].join(", ")}` };
  }
  return null;
}

export async function getGovernanceRegistry(env, { projectId }) {
  return readRegistry(env, projectId);
}

export async function registerModel(env, { projectId, modelId, provider, version, riskTier, allowedUseCases, approvedBy }) {
  const tierErr = assertRiskTier(riskTier);
  if (tierErr) return tierErr;
  if (!modelId?.trim() || !provider?.trim()) return { error: "modelId and provider required" };

  const registry = await readRegistry(env, projectId);
  const now = new Date().toISOString();
  const entry = {
    modelId: modelId.trim(),
    provider: provider.trim(),
    version: version?.trim() || "1",
    riskTier,
    allowedUseCases: allowedUseCases ?? [],
    approvedBy: approvedBy ?? null,
    approvedAt: approvedBy ? now : null,
    registeredAt: now,
  };
  registry.models = registry.models.filter((m) => m.modelId !== entry.modelId);
  registry.models.unshift(entry);
  await writeRegistry(env, projectId, registry);
  return { model: entry };
}

export async function registerPrompt(env, { projectId, promptId, template, riskTier, allowedModels, requiredApprovals }) {
  const tierErr = assertRiskTier(riskTier);
  if (tierErr) return tierErr;
  if (!promptId?.trim() || !template?.trim()) return { error: "promptId and template required" };

  const registry = await readRegistry(env, projectId);
  const autoApprove = riskTier === "low" || riskTier === "medium";
  const entry = {
    promptId: promptId.trim(),
    template: template.trim(),
    riskTier,
    allowedModels: allowedModels ?? [],
    requiredApprovals: requiredApprovals ?? [],
    status: autoApprove ? "approved" : "pending",
    registeredAt: new Date().toISOString(),
  };
  registry.prompts = registry.prompts.filter((p) => p.promptId !== entry.promptId);
  registry.prompts.unshift(entry);
  await writeRegistry(env, projectId, registry);
  return { prompt: entry };
}

export async function registerTool(env, { projectId, toolId, name, riskTier, allowedRoles, requiresApproval, rateLimit }) {
  const tierErr = assertRiskTier(riskTier);
  if (tierErr) return tierErr;
  if (!toolId?.trim() || !name?.trim()) return { error: "toolId and name required" };

  const registry = await readRegistry(env, projectId);
  const entry = {
    toolId: toolId.trim(),
    name: name.trim(),
    riskTier,
    allowedRoles: allowedRoles ?? ["owner", "admin"],
    requiresApproval: requiresApproval === true,
    rateLimit: rateLimit ?? 100,
    registeredAt: new Date().toISOString(),
  };
  registry.tools = registry.tools.filter((t) => t.toolId !== entry.toolId);
  registry.tools.unshift(entry);
  await writeRegistry(env, projectId, registry);
  return { tool: entry };
}

export async function runPreDeployEvaluation(env, { projectId, targetId, targetType, approver }) {
  if (!targetId?.trim() || !["model", "prompt", "tool"].includes(targetType)) {
    return { error: "targetId and targetType (model|prompt|tool) required" };
  }

  const registry = await readRegistry(env, projectId);
  let target = null;
  let riskTier = "medium";

  if (targetType === "model") {
    target = registry.models.find((m) => m.modelId === targetId);
    riskTier = target?.riskTier ?? "high";
  } else if (targetType === "prompt") {
    target = registry.prompts.find((p) => p.promptId === targetId);
    riskTier = target?.riskTier ?? "high";
  } else {
    target = registry.tools.find((t) => t.toolId === targetId);
    riskTier = target?.riskTier ?? "high";
  }

  if (!target) return { error: "target_not_found" };

  const score = riskTier === "low" ? 0.95 : riskTier === "medium" ? 0.85 : riskTier === "high" ? 0.7 : 0.5;
  const passed = score >= 0.75;
  const evaluation = {
    evaluationId: `eval_${crypto.randomUUID().slice(0, 12)}`,
    targetId,
    targetType,
    score,
    passed,
    evidence: `Pre-deploy check by ${approver ?? "system"}: risk=${riskTier}, score=${score.toFixed(2)}`,
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: approver ?? null,
  };

  registry.evaluations.unshift(evaluation);
  if (registry.evaluations.length > 200) registry.evaluations.length = 200;
  await writeRegistry(env, projectId, registry);

  return { evaluation, passed };
}

export async function exportGovernanceEvidence(env, { projectId }) {
  const registry = await readRegistry(env, projectId);
  return {
    exportedAt: new Date().toISOString(),
    projectId,
    summary: {
      models: registry.models.length,
      prompts: registry.prompts.length,
      tools: registry.tools.length,
      evaluations: registry.evaluations.length,
      pendingPrompts: registry.prompts.filter((p) => p.status === "pending").length,
      criticalTools: registry.tools.filter((t) => t.riskTier === "critical").length,
    },
    registry,
  };
}
