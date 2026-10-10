"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bot, Plus, GitBranch, Rocket, FlaskConical, Users,
  DollarSign, Gauge, Palette, Heart, Brain, History,
  Loader2, CheckCircle2, XCircle, ArrowRight, Copy, Code,
} from "lucide-react";
import { ConsoleShell } from "@/app/components/console-shell";
import { ConsolePageHeader } from "@/app/components/console-page-header";
import { ConsoleProjectRoomBar } from "@/app/components/console-project-room-bar";
import { WorkerBackendBadge } from "@/app/components/worker-backend-badge";
import { cn } from "@/lib/utils";
import { useWorkerChatClient } from "@/lib/use-worker-chat-client";
import {
  createAgentPlatform,
  createWorkerAgentPlatformClient,
  type AgentPlatformApi,
  type AgentConfig,
  type AgentPersonality,
  type AgentStatus,
  type SandboxResult,
  type AgentTier,
  type DeployStage,
  type WorkerAgentPlatformClient,
} from "@fluxy-chat/sdk";

function localHelperPlatform(): AgentPlatformApi {
  const p = createAgentPlatform();
  p.createAgent({
    name: "Rate probe",
    description: "Local SDK helper for tier tables",
    systemPrompt: "You are a probe.",
    model: "gpt-4o-mini",
    temperature: 0,
    maxTokens: 16,
    tools: [],
    personality: p.createPersonality("professional"),
  });
  return p;
}

// ─── Page ────────────────────────────────────────────

export default function AgentPlatformPage() {
  const chatClient = useWorkerChatClient("agent-platform");
  const workerPlatform = useMemo(
    () => (chatClient ? createWorkerAgentPlatformClient(chatClient) : null),
    [chatClient],
  );
  const [platform] = useState<AgentPlatformApi | null>(localHelperPlatform());
  const [workerAgents, setWorkerAgents] = useState<Array<{ id: string; name: string; status: AgentStatus; workspaceId?: string }>>([]);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"agents" | "builder" | "versioning" | "deploy" | "sandbox" | "tenancy" | "costs" | "rates" | "abtest" | "personality" | "emotion" | "memory">("agents");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!workerPlatform) {
      setWorkerAgents([]);
      return;
    }
    void workerPlatform.listAgents().then(setWorkerAgents).catch(() => setWorkerAgents([]));
  }, [workerPlatform, tick]);

  if (!platform) {
    return (
      <ConsoleShell>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </ConsoleShell>
    );
  }

  const tabs: { id: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { id: "agents", label: "Agents", icon: <Bot className="size-3.5" /> },
    { id: "builder", label: "No-Code Builder", icon: <Plus className="size-3.5" /> },
    { id: "versioning", label: "Versioning", icon: <GitBranch className="size-3.5" /> },
    { id: "deploy", label: "CI/CD Deploy", icon: <Rocket className="size-3.5" /> },
    { id: "sandbox", label: "Sandbox", icon: <FlaskConical className="size-3.5" /> },
    { id: "tenancy", label: "Multi-Tenancy", icon: <Users className="size-3.5" /> },
    { id: "costs", label: "Cost Tracking", icon: <DollarSign className="size-3.5" /> },
    { id: "rates", label: "Rate Limits", icon: <Gauge className="size-3.5" /> },
    { id: "abtest", label: "A/B Testing", icon: <FlaskConical className="size-3.5" /> },
    { id: "personality", label: "Personality", icon: <Palette className="size-3.5" /> },
    { id: "emotion", label: "Emotion AI", icon: <Heart className="size-3.5" /> },
    { id: "memory", label: "Cross-Platform Memory", icon: <Brain className="size-3.5" /> },
  ];

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="AI Agent Platform"
        description="No-code builder, versioning, CI/CD, sandbox testing, multi-tenancy, cost tracking, rate limiting, A/B testing, personality designer, emotional intelligence, cross-platform memory"
        actions={<WorkerBackendBadge connected={Boolean(workerPlatform)} label="Agent Platform" />}
      />
      <ConsoleProjectRoomBar
        requireProject
        hint={workerPlatform ? "Agents, versions, deploy, memory, spend, and A/B counters are D1. Personality and tier tables stay SDK helpers." : "Sign in so listAgents hits the Worker."}
      />
      {workerError ? (
        <p className="mx-4 mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{workerError}</p>
      ) : null}

      <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === tab.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4" key={tick}>
        {activeTab === "agents" && <AgentsPanel workerAgents={workerAgents} workerConnected={Boolean(workerPlatform)} />}
        {activeTab === "builder" && (
          <BuilderPanel
            platform={platform}
            workerPlatform={workerPlatform}
            onReload={() => setTick((t) => t + 1)}
            onWorkerError={setWorkerError}
          />
        )}
        {activeTab === "versioning" && (
          <VersioningPanel
            workerPlatform={workerPlatform}
            workerAgents={workerAgents}
            onReload={() => setTick((t) => t + 1)}
            onWorkerError={setWorkerError}
          />
        )}
        {activeTab === "deploy" && (
          <DeployPanel
            workerPlatform={workerPlatform}
            workerAgents={workerAgents}
            onReload={() => setTick((t) => t + 1)}
            onWorkerError={setWorkerError}
          />
        )}
        {activeTab === "sandbox" && (
          <SandboxPanel workerPlatform={workerPlatform} workerAgents={workerAgents} onWorkerError={setWorkerError} />
        )}
        {activeTab === "tenancy" && <TenancyPanel workerAgents={workerAgents} workerConnected={Boolean(workerPlatform)} />}
        {activeTab === "costs" && (
          <CostsPanel
            workerPlatform={workerPlatform}
            workerAgents={workerAgents}
            onReload={() => setTick((t) => t + 1)}
            onWorkerError={setWorkerError}
          />
        )}
        {activeTab === "rates" && <RatesPanel platform={platform} />}
        {activeTab === "abtest" && (
          <AbTestPanel
            workerPlatform={workerPlatform}
            onReload={() => setTick((t) => t + 1)}
            onWorkerError={setWorkerError}
          />
        )}
        {activeTab === "personality" && <PersonalityPanel platform={platform} />}
        {activeTab === "emotion" && <EmotionPanel platform={platform} />}
        {activeTab === "memory" && (
          <MemoryPanel
            workerPlatform={workerPlatform}
            workerAgents={workerAgents}
            onReload={() => setTick((t) => t + 1)}
            onWorkerError={setWorkerError}
          />
        )}
      </div>
    </ConsoleShell>
  );
}

// ─── Agents List ─────────────────────────────────────

function AgentsPanel({
  workerAgents,
  workerConnected,
}: {
  workerAgents: Array<{ id: string; name: string; status: AgentStatus; workspaceId?: string }>;
  workerConnected: boolean;
}) {
  if (!workerConnected) {
    return <p className="text-sm text-muted-foreground">Sign in to list D1 agents (`GET /agents/platform/agents`). Seeded local agents are not production data.</p>;
  }
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Worker agents ({workerAgents.length})
      </h3>
      {workerAgents.length === 0 ? (
        <p className="text-sm text-muted-foreground">None yet. Use No-Code Builder; that POST goes to D1.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {workerAgents.map((agent) => (
            <div key={agent.id} className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="text-sm font-semibold">{agent.name}</div>
              <code className="text-[10px] text-muted-foreground">{agent.id}</code>
              <div className="mt-1 text-[10px] uppercase text-muted-foreground">{agent.status}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── No-Code Builder ─────────────────────────────────

function BuilderPanel({
  platform,
  workerPlatform,
  onReload,
  onWorkerError,
}: {
  platform: AgentPlatformApi;
  workerPlatform: WorkerAgentPlatformClient | null;
  onReload: () => void;
  onWorkerError: (msg: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [tools, setTools] = useState("");
  const [tier, setTier] = useState<AgentTier>("free");

  const handleCreate = () => {
    if (!name.trim()) return;
    const config: AgentConfig = {
      name: name.trim(),
      description: desc.trim(),
      systemPrompt: prompt.trim() || "You are a helpful assistant.",
      model,
      temperature: 0.5,
      maxTokens: 500,
      tools: tools.split(",").map((t) => t.trim()).filter(Boolean),
      personality: platform.createPersonality("professional"),
      tier,
      workspaceId: "default",
    };
    if (!workerPlatform) {
      onWorkerError("Sign in so createAgent hits D1.");
      return;
    }
    void workerPlatform.createAgent({ name: config.name, workspaceId: "default", config })
      .then(() => {
        onWorkerError(null);
        onReload();
      })
      .catch((err) => onWorkerError(err instanceof Error ? err.message : "Worker create failed"));
    setName(""); setDesc(""); setPrompt(""); setTools("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Create new agent
        </h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Description</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What does this agent do?" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">System prompt</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="You are..." rows={3} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium">Model</label>
              <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o mini</option>
                <option value="claude-sonnet">Claude Sonnet</option>
                <option value="llama-3.1-70b">Llama 3.1 70B</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Tier</label>
              <select value={tier} onChange={(e) => setTier(e.target.value as AgentTier)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Tools (comma-separated)</label>
            <input value={tools} onChange={(e) => setTools(e.target.value)} placeholder="faq_search, ticket_create" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <button type="button" onClick={handleCreate} disabled={!name.trim()} className="w-full rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
            <Plus className="mr-1 inline size-3.5" /> Create agent
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Visual flow builder
        </h3>
        <div className="rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
          <p className="mb-3 text-xs text-muted-foreground">Define a trigger → condition → action flow for your agent.</p>
          <div className="space-y-2">
            {[
              { type: "trigger", label: "Message received", color: "bg-blue-500/15 text-blue-600" },
              { type: "condition", label: "Is it a FAQ?", color: "bg-amber-500/15 text-amber-600" },
              { type: "llm_call", label: "Generate response", color: "bg-purple-500/15 text-purple-600" },
              { type: "output", label: "Send reply", color: "bg-green-500/15 text-green-600" },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={cn("rounded px-2 py-1 text-[10px] font-semibold uppercase", step.color)}>{step.type}</span>
                <span className="text-sm">{step.label}</span>
                {i < 3 && <ArrowRight className="ml-auto size-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
          <div className="mt-3 rounded bg-muted/50 p-2 text-[10px] font-mono text-muted-foreground">
            createFlow([ trigger, condition, llm_call, output ])
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Versioning ──────────────────────────────────────

function VersioningPanel({
  workerPlatform,
  workerAgents,
  onReload,
  onWorkerError,
}: {
  workerPlatform: WorkerAgentPlatformClient | null;
  workerAgents: Array<{ id: string; name: string; status: AgentStatus; workspaceId?: string }>;
  onReload: () => void;
  onWorkerError: (msg: string | null) => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState("");
  const [versions, setVersions] = useState<Array<{ version: string; commitHash: string; message: string | null; author: string; createdAt: string }>>([]);
  const [message, setMessage] = useState("Dashboard commit");

  useEffect(() => {
    if (!selectedAgent && workerAgents[0]) setSelectedAgent(workerAgents[0].id);
  }, [workerAgents, selectedAgent]);

  useEffect(() => {
    if (!workerPlatform || !selectedAgent) {
      setVersions([]);
      return;
    }
    void workerPlatform.listVersions(selectedAgent).then(setVersions).catch(() => setVersions([]));
  }, [workerPlatform, selectedAgent]);

  if (!workerPlatform) {
    return <p className="text-sm text-muted-foreground">Sign in to list D1 versions (`GET /agents/platform/agents/:id/versions`).</p>;
  }
  if (workerAgents.length === 0) {
    return <p className="text-sm text-muted-foreground">Create an agent in No-Code Builder first.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-xs font-medium">Agent:</label>
        <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
          {workerAgents.map((agent) => (
            <option key={agent.id} value={agent.id}>{agent.name} ({agent.id})</option>
          ))}
        </select>
        <input value={message} onChange={(e) => setMessage(e.target.value)} className="min-w-[12rem] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
        <button
          type="button"
          onClick={() => {
            if (!selectedAgent) return;
            void workerPlatform.commitVersion(selectedAgent, { version: `v${Date.now()}`, message })
              .then(() => {
                onWorkerError(null);
                onReload();
                return workerPlatform.listVersions(selectedAgent).then(setVersions);
              })
              .catch((err) => onWorkerError(err instanceof Error ? err.message : "Commit failed"));
          }}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Commit version
        </button>
      </div>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Version history ({versions.length})
      </h3>
      <div className="space-y-2">
        {versions.map((v, i) => (
          <div key={`${v.version}-${v.commitHash}`} className={cn(
            "flex items-center gap-3 rounded-lg border p-3",
            i === 0 ? "border-foreground bg-foreground/5" : "border-border bg-card",
          )}>
            <GitBranch className="size-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{v.version}</span>
                <code className="text-[10px] text-muted-foreground">{v.commitHash.slice(0, 8)}</code>
                {i === 0 && <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-green-600">LATEST</span>}
              </div>
              <div className="text-xs text-muted-foreground">{v.message || "—"}</div>
              <div className="text-[10px] text-muted-foreground">by {v.author} · {new Date(v.createdAt).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CI/CD Deploy ────────────────────────────────────

function DeployPanel({
  workerPlatform,
  workerAgents,
  onReload,
  onWorkerError,
}: {
  workerPlatform: WorkerAgentPlatformClient | null;
  workerAgents: Array<{ id: string; name: string; status: AgentStatus; workspaceId?: string }>;
  onReload: () => void;
  onWorkerError: (msg: string | null) => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState("");
  const [deploys, setDeploys] = useState<DeployStage[]>([]);
  const stages: Array<"dev" | "staging" | "production"> = ["dev", "staging", "production"];
  const stageColors = { dev: "bg-blue-500/15 text-blue-600", staging: "bg-amber-500/15 text-amber-600", production: "bg-green-500/15 text-green-600" };

  useEffect(() => {
    if (!selectedAgent && workerAgents[0]) setSelectedAgent(workerAgents[0].id);
  }, [workerAgents, selectedAgent]);

  useEffect(() => {
    if (!workerPlatform || !selectedAgent) {
      setDeploys([]);
      return;
    }
    void workerPlatform.listDeploys(selectedAgent).then(setDeploys).catch(() => setDeploys([]));
  }, [workerPlatform, selectedAgent]);

  if (!workerPlatform) {
    return <p className="text-sm text-muted-foreground">Sign in to deploy (`POST /agents/platform/agents/:id/deploy`).</p>;
  }
  if (workerAgents.length === 0) {
    return <p className="text-sm text-muted-foreground">Create an agent first.</p>;
  }

  const client = workerPlatform;

  function deployStage(stage: "dev" | "staging" | "production") {
    if (!selectedAgent) return;
    void client.commitVersion(selectedAgent, { version: `v${Date.now()}`, message: `Deploy ${stage}` })
      .then(({ version }) => client.deploy(selectedAgent, { stage, version }))
      .then(() => {
        onWorkerError(null);
        onReload();
        return client.listDeploys(selectedAgent).then(setDeploys);
      })
      .catch((err) => onWorkerError(err instanceof Error ? err.message : "Worker deploy failed"));
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <label className="text-xs font-medium">Agent:</label>
        <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
          {workerAgents.map((agent) => (
            <option key={agent.id} value={agent.id}>{agent.name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {stages.map((stage) => {
          const stageDeploys = deploys.filter((d) => d.stage === stage);
          const active = stageDeploys.find((d) => d.status === "active");
          return (
            <div key={stage} className="rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
              <div className="flex items-center gap-2">
                <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold uppercase", stageColors[stage])}>{stage}</span>
                {active && <CheckCircle2 className="size-3.5 text-green-500" />}
              </div>
              {active ? (
                <div className="mt-2">
                  <div className="text-sm font-medium">{active.version}</div>
                  <div className="text-[10px] text-muted-foreground">by {active.deployedBy} · {new Date(active.deployedAt).toLocaleString()}</div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No active deploy</p>
              )}
              <button
                type="button"
                onClick={() => deployStage(stage)}
                className="mt-2 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                Commit + deploy
              </button>
              {stageDeploys.length > 1 ? (
                <div className="mt-2 text-[10px] text-muted-foreground">{stageDeploys.length} rows in D1</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sandbox ─────────────────────────────────────────

function SandboxPanel({
  workerPlatform,
  workerAgents,
  onWorkerError,
}: {
  workerPlatform: WorkerAgentPlatformClient | null;
  workerAgents: Array<{ id: string; name: string; status: AgentStatus; workspaceId?: string }>;
  onWorkerError: (msg: string | null) => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState("");
  const [input, setInput] = useState("Hello, I need help with my account");
  const [result, setResult] = useState<SandboxResult | null>(null);

  useEffect(() => {
    if (!selectedAgent && workerAgents[0]) setSelectedAgent(workerAgents[0].id);
  }, [workerAgents, selectedAgent]);

  const handleRun = () => {
    if (!workerPlatform || !selectedAgent) {
      onWorkerError("Sign in and pick a Worker agent.");
      return;
    }
    void workerPlatform.getAgent(selectedAgent).then((agent) => {
      if (!agent) {
        onWorkerError("Agent not found on Worker.");
        return;
      }
      const local = createAgentPlatform();
      local.createAgent(agent.config);
      const id = local.listAgents()[0]?.id;
      if (!id) return;
      setResult(local.runSandbox(id, input));
      onWorkerError(null);
    }).catch((err) => onWorkerError(err instanceof Error ? err.message : "Sandbox failed"));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Testing sandbox</h3>
        <p className="mb-3 text-xs text-muted-foreground">Loads the D1 config, then `runSandbox` in the browser. No LLM call, no D1 write.</p>
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium">Agent</label>
          <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {workerAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium">Test input</label>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <button type="button" onClick={handleRun} className="w-full rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90">
          <FlaskConical className="mr-1 inline size-3.5" /> Run sandbox test
        </button>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Result</h3>
        {result ? (
          <div className="space-y-3">
            <div className={cn("flex items-center gap-2 rounded-lg p-2 text-sm font-medium", result.success ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600")}>
              {result.success ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
              {result.success ? "Success" : "Failed"} · {result.duration}ms
            </div>
            <div className="rounded-lg bg-card shadow-[var(--shadow-2)] p-3">
              <div className="text-[10px] uppercase text-muted-foreground">Output</div>
              <p className="mt-1 text-sm">{result.output}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-card shadow-[var(--shadow-2)] p-2 text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Input tokens</div>
                <div className="text-sm font-bold tabular-nums">{result.tokenUsage.input}</div>
              </div>
              <div className="rounded-lg bg-card shadow-[var(--shadow-2)] p-2 text-center">
                <div className="text-[10px] uppercase text-muted-foreground">Output tokens</div>
                <div className="text-sm font-bold tabular-nums">{result.tokenUsage.output}</div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="mb-1 text-[10px] uppercase text-muted-foreground">Logs</div>
              <div className="space-y-0.5">
                {result.logs.map((log, i) => (
                  <div key={i} className="font-mono text-[10px] text-muted-foreground">{log}</div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Run a test to see results</p>
        )}
      </div>
    </div>
  );
}

// ─── Multi-Tenancy ───────────────────────────────────

function TenancyPanel({
  workerAgents,
  workerConnected,
}: {
  workerAgents: Array<{ id: string; name: string; status: AgentStatus; workspaceId?: string }>;
  workerConnected: boolean;
}) {
  if (!workerConnected) {
    return <p className="text-sm text-muted-foreground">Sign in to group D1 agents by workspace_id.</p>;
  }
  const grouped = new Map<string, typeof workerAgents>();
  for (const agent of workerAgents) {
    const ws = agent.workspaceId || "default";
    const list = grouped.get(ws) ?? [];
    list.push(agent);
    grouped.set(ws, list);
  }
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Workspaces ({grouped.size})
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[...grouped.entries()].map(([ws, agents]) => (
          <div key={ws} className="rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">{ws}</h4>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{agents.length} agent(s) on this project</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {agents.slice(0, 3).map((agent) => (
                <span key={agent.id} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{agent.name}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cost Tracking ───────────────────────────────────

function CostsPanel({
  workerPlatform,
  workerAgents,
  onReload,
  onWorkerError,
}: {
  workerPlatform: WorkerAgentPlatformClient | null;
  workerAgents: Array<{ id: string; name: string; status: AgentStatus; workspaceId?: string }>;
  onReload: () => void;
  onWorkerError: (msg: string | null) => void;
}) {
  const [summaries, setSummaries] = useState<Array<{
    agentId: string;
    entries: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostCents: number;
    avgCostPerRequest: number;
  }>>([]);

  useEffect(() => {
    if (!workerPlatform) {
      setSummaries([]);
      return;
    }
    void workerPlatform.summarizeCosts().then(setSummaries).catch(() => setSummaries([]));
  }, [workerPlatform]);

  if (!workerPlatform) {
    return <p className="text-sm text-muted-foreground">Sign in so spend hits D1 (`GET /agents/platform/costs`). This is a token ledger, not a Stripe invoice.</p>;
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">Token rows in `agent_platform_costs`. Not billing, not Stripe.</p>
      {workerAgents.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            const agent = workerAgents[0];
            if (!agent) return;
            void workerPlatform.recordCost(agent.id, {
              inputTokens: 120,
              outputTokens: 80,
              model: "gpt-4o-mini",
              costCents: 1,
            })
              .then(() => {
                onWorkerError(null);
                onReload();
                return workerPlatform.summarizeCosts().then(setSummaries);
              })
              .catch((err) => onWorkerError(err instanceof Error ? err.message : "recordCost failed"));
          }}
          className="mb-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          Record sample spend on {workerAgents[0]?.name}
        </button>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">Create an agent first.</p>
      )}
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Cost tracking per agent
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {workerAgents.map((agent) => {
          const summary = summaries.find((s) => s.agentId === agent.id);
          return (
            <div key={agent.id} className="rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
              <h4 className="text-sm font-semibold">{agent.name}</h4>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Requests</span><span className="tabular-nums">{summary?.entries ?? 0}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Input tokens</span><span className="tabular-nums">{(summary?.totalInputTokens ?? 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Output tokens</span><span className="tabular-nums">{(summary?.totalOutputTokens ?? 0).toLocaleString()}</span></div>
                <div className="flex justify-between border-t border-border pt-1 mt-1"><span className="text-muted-foreground">Total cost</span><span className="font-bold tabular-nums">${((summary?.totalCostCents ?? 0) / 100).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Avg/req</span><span className="tabular-nums">${((summary?.avgCostPerRequest ?? 0) / 100).toFixed(4)}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Rate Limits ─────────────────────────────────────

function RatesPanel({ platform }: { platform: AgentPlatformApi }) {
  const tiers: AgentTier[] = ["free", "starter", "pro", "enterprise"];
  const tierColors: Record<AgentTier, string> = {
    free: "bg-muted text-muted-foreground",
    starter: "bg-blue-500/15 text-blue-600",
    pro: "bg-purple-500/15 text-purple-600",
    enterprise: "bg-amber-500/15 text-amber-600",
  };

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">Tier tables live in the SDK (`getRateLimit`). They are not D1 quotas.</p>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Rate limits by tier
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => {
          const limit = platform.getRateLimit(tier);
          return (
            <div key={tier} className="rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
              <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold uppercase", tierColors[tier])}>{tier}</span>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Req/min</span><span className="font-bold tabular-nums">{limit.requestsPerMinute}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Req/day</span><span className="font-bold tabular-nums">{limit.requestsPerDay.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tokens/day</span><span className="font-bold tabular-nums">{limit.tokensPerDay.toLocaleString()}</span></div>
              </div>
            </div>
          );
        })}
      </div>

      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Test rate limit check
      </h3>
      <div className="space-y-1">
        {Array.from({ length: 12 }, (_, i) => {
          const result = platform.checkRateLimit(platform.listAgents()[0]?.id ?? "");
          return (
            <div key={i} className={cn("flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs", result.allowed ? "bg-green-500/5" : "bg-red-500/5")}>
              {result.allowed ? <CheckCircle2 className="size-3 text-green-500" /> : <XCircle className="size-3 text-red-500" />}
              <span>Request #{i + 1}</span>
              {!result.allowed && <span className="text-red-600">{result.reason}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── A/B Testing ─────────────────────────────────────

function AbTestPanel({
  workerPlatform,
  onReload,
  onWorkerError,
}: {
  workerPlatform: WorkerAgentPlatformClient | null;
  onReload: () => void;
  onWorkerError: (msg: string | null) => void;
}) {
  const [tests, setTests] = useState<Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    results: Array<{ variantId: string; variantName: string; exposures: number; conversions: number; conversionRate: number }>;
  }>>([]);

  useEffect(() => {
    if (!workerPlatform) {
      setTests([]);
      return;
    }
    void workerPlatform.listAbTests().then(setTests).catch(() => setTests([]));
  }, [workerPlatform]);

  if (!workerPlatform) {
    return <p className="text-sm text-muted-foreground">Sign in so A/B rows live in D1 (`GET /agents/platform/ab-tests`). Weighted pick + counters, not a stats warehouse.</p>;
  }

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">Counters persist on `agent_platform_ab_tests.variants_json`. Run records one exposure and one conversion.</p>
      <button
        type="button"
        onClick={() => {
          void workerPlatform.createAbTest({
            name: "Response style test",
            description: "Compare concise vs verbose responses",
            metric: "satisfaction_score",
            variants: [
              { id: "v_concise", name: "Concise", trafficPercent: 50, config: { maxTokens: 200 } },
              { id: "v_verbose", name: "Verbose", trafficPercent: 50, config: { maxTokens: 800 } },
            ],
          })
            .then(() => {
              onWorkerError(null);
              onReload();
              return workerPlatform.listAbTests().then(setTests);
            })
            .catch((err) => onWorkerError(err instanceof Error ? err.message : "createAbTest failed"));
        }}
        className="mb-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
      >
        Create style test
      </button>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        A/B Tests ({tests.length})
      </h3>
      <div className="space-y-3">
        {tests.map((test) => (
          <div key={test.id} className="rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{test.name}</h4>
              <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", test.status === "running" ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground")}>{test.status}</span>
            </div>
            <p className="text-xs text-muted-foreground">{test.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {test.results.map((r) => (
                <div key={r.variantId} className="rounded-lg border border-border p-2 text-xs">
                  <div className="font-semibold">{r.variantName}</div>
                  <div className="text-muted-foreground">{r.exposures} exposures · {r.conversions} conversions</div>
                  <div className="mt-1 font-bold tabular-nums">{(r.conversionRate * 100).toFixed(1)}%</div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                void workerPlatform.runAbTest(test.id)
                  .then(() => {
                    onWorkerError(null);
                    return workerPlatform.listAbTests().then(setTests);
                  })
                  .catch((err) => onWorkerError(err instanceof Error ? err.message : "runAbTest failed"));
              }}
              className="mt-2 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              Run test iteration
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Personality Designer ────────────────────────────

function PersonalityPanel({ platform }: { platform: AgentPlatformApi }) {
  const presets: Array<"supportive" | "analytical" | "creative" | "professional" | "energetic"> = ["supportive", "analytical", "creative", "professional", "energetic"];
  const presetColors: Record<string, string> = {
    supportive: "bg-pink-500/15 text-pink-600",
    analytical: "bg-blue-500/15 text-blue-600",
    creative: "bg-purple-500/15 text-purple-600",
    professional: "bg-slate-500/15 text-slate-600",
    energetic: "bg-amber-500/15 text-amber-600",
  };
  const [selected, setSelected] = useState<AgentPersonality>(platform.createPersonality("supportive"));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Personality presets</h3>
        <div className="space-y-2">
          {presets.map((preset) => {
            const p = platform.createPersonality(preset);
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setSelected(p)}
                className={cn("flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors", selected.tone === p.tone && selected.humor === p.humor ? "border-foreground bg-foreground/5" : "border-border bg-card hover:bg-muted")}
              >
                <span className={cn("rounded px-2 py-0.5 text-[10px] font-semibold uppercase", presetColors[preset])}>{preset}</span>
                <div className="text-xs text-muted-foreground">tone: {p.tone}, humor: {p.humor}, empathy: {p.empathy}</div>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trait sliders</h3>
        <div className="space-y-3 rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
          {([
            { key: "humor", label: "Humor" },
            { key: "formality", label: "Formality" },
            { key: "verbosity", label: "Verbosity" },
            { key: "empathy", label: "Empathy" },
          ] as const).map(({ key, label }) => (
            <div key={key}>
              <div className="flex justify-between text-xs"><span className="font-medium">{label}</span><span className="tabular-nums text-muted-foreground">{(selected[key] * 100).toFixed(0)}%</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground" style={{ width: `${selected[key] * 100}%` }} />
              </div>
            </div>
          ))}
          <div className="mt-2 rounded bg-muted/50 p-2 text-[10px] font-mono text-muted-foreground">
            tone: "{selected.tone}" · humor: {selected.humor} · formality: {selected.formality} · verbosity: {selected.verbosity} · empathy: {selected.empathy}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Emotion AI ──────────────────────────────────────

function EmotionPanel({ platform }: { platform: AgentPlatformApi }) {
  const [input, setInput] = useState("I'm really frustrated with this bug, it's urgent!");
  const emotion = platform.detectEmotion(input);
  const emotionColors: Record<string, string> = {
    angry: "bg-red-500/15 text-red-600",
    sad: "bg-blue-500/15 text-blue-600",
    happy: "bg-green-500/15 text-green-600",
    confused: "bg-amber-500/15 text-amber-600",
    urgent: "bg-orange-500/15 text-orange-600",
    neutral: "bg-muted text-muted-foreground",
  };

  const testMessages = [
    "I'm really frustrated with this bug, it's urgent!",
    "Thank you so much, this is amazing! 🎉",
    "I don't understand how to use this feature",
    "I'm sad that my data was lost",
    "Can you help me with this?",
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Emotion detection</h3>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        <div className="mt-2 space-y-1">
          <p className="text-[10px] text-muted-foreground">Quick test:</p>
          {testMessages.map((msg) => (
            <button key={msg} type="button" onClick={() => setInput(msg)} className="block w-full truncate rounded px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-muted">
              "{msg.slice(0, 50)}..."
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detected emotion</h3>
        <div className="rounded-xl bg-card shadow-[var(--shadow-2)] p-4">
          <div className="flex items-center gap-3">
            <span className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold capitalize", emotionColors[emotion.emotion] || emotionColors.neutral)}>
              {emotion.emotion}
            </span>
            <div className="flex-1">
              <div className="text-[10px] uppercase text-muted-foreground">Confidence</div>
              <div className="text-sm font-bold tabular-nums">{(emotion.score * 100).toFixed(0)}%</div>
            </div>
          </div>
          <div className="mt-3 rounded bg-muted/50 p-2 text-xs">
            <span className="font-medium">Adaptive tone:</span> {emotion.adaptTone}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cross-Platform Memory ───────────────────────────

function MemoryPanel({
  workerPlatform,
  workerAgents,
  onReload,
  onWorkerError,
}: {
  workerPlatform: WorkerAgentPlatformClient | null;
  workerAgents: Array<{ id: string; name: string; status: AgentStatus; workspaceId?: string }>;
  onReload: () => void;
  onWorkerError: (msg: string | null) => void;
}) {
  const [agentId, setAgentId] = useState("");
  const [userId, setUserId] = useState("user_123");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [platformInput, setPlatformInput] = useState("web");
  const [tick, setTick] = useState(0);
  const [workerMemories, setWorkerMemories] = useState<Array<{ key: string; value: string; platform: string; createdAt?: string }>>([]);

  useEffect(() => {
    if (!agentId && workerAgents[0]) setAgentId(workerAgents[0].id);
  }, [workerAgents, agentId]);

  useEffect(() => {
    if (!workerPlatform || !agentId) {
      setWorkerMemories([]);
      return;
    }
    void workerPlatform.listMemories(agentId, { userId })
      .then((rows) => setWorkerMemories(rows.map((m) => ({ key: m.key, value: m.value, platform: m.platform, createdAt: m.timestamp }))))
      .catch(() => setWorkerMemories([]));
  }, [workerPlatform, agentId, userId, tick]);

  const unified = new Map<string, { value: string; platform: string; createdAt?: string }>();
  for (const m of [...workerMemories].reverse()) {
    unified.set(m.key, m);
  }

  const handleStore = () => {
    if (!key.trim() || !value.trim() || !workerPlatform || !agentId) {
      onWorkerError("Sign in, pick an agent, then store.");
      return;
    }
    void workerPlatform.upsertMemory(agentId, {
      key: key.trim(),
      value: value.trim(),
      userId,
      platform: platformInput,
    })
      .then(() => {
        onWorkerError(null);
        setTick((t) => t + 1);
        onReload();
      })
      .catch((err) => onWorkerError(err instanceof Error ? err.message : "Worker memory failed"));
    setKey(""); setValue("");
  };

  const platformIcons: Record<string, string> = { web: "🌐", whatsapp: "💬", email: "📧", telegram: "✈️", slack: "💼" };

  return (
    <div className="grid gap-4 lg:grid-cols-2" key={tick}>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Store memory</h3>
        <div className="space-y-2">
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {workerAgents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Key (e.g. preference)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            <select value={platformInput} onChange={(e) => setPlatformInput(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="web">🌐 Web</option>
              <option value="whatsapp">💬 WhatsApp</option>
              <option value="email">📧 Email</option>
              <option value="telegram">✈️ Telegram</option>
              <option value="slack">💼 Slack</option>
            </select>
          </div>
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button type="button" onClick={handleStore} disabled={!key.trim() || !value.trim()} className="w-full rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
            Store memory
          </button>
        </div>

        <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Raw entries ({workerMemories.length})
        </h3>
        <div className="space-y-1">
          {workerMemories.map((m) => (
            <div key={`w-${m.key}-${m.platform}`} className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs">
              <span>{platformIcons[m.platform] || "📱"}</span>
              <span className="font-medium">{m.key}:</span>
              <span className="text-muted-foreground">{m.value}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{m.platform}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Unified memory (cross-platform)
        </h3>
        <div className="space-y-2">
          {[...unified.entries()].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-card shadow-[var(--shadow-2)] p-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{platformIcons[v.platform] || "📱"}</span>
                <div>
                  <div className="text-sm font-semibold">{k}</div>
                  <div className="text-xs text-muted-foreground">{v.value}</div>
                </div>
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">from {v.platform}{v.createdAt ? ` · ${new Date(v.createdAt).toLocaleString()}` : ""}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
