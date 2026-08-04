"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2, Play, ShieldCheck } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleFeedback } from "../components/console-feedback";
import { Button, Input, Panel, Section, Textarea } from "../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  exportGovernanceEvidence,
  getAiPolicyViolations,
  getGovernanceRegistry,
  listAiActionPolicies,
  registerGovernanceModel,
  registerGovernancePrompt,
  registerGovernanceTool,
  runGovernanceEvaluation,
  type GovernanceEvaluation,
  type GovernanceRegistry,
  type RiskTier,
} from "@/lib/ai-governance-client";

const TIERS: RiskTier[] = ["low", "medium", "high", "critical"];

function tierBadge(tier: RiskTier) {
  const variant = tier === "critical" || tier === "high" ? "destructive" : tier === "medium" ? "secondary" : "outline";
  return <Badge variant={variant}>{tier}</Badge>;
}

export default function AiGovernancePage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [registry, setRegistry] = useState<GovernanceRegistry | null>(null);
  const [policyCount, setPolicyCount] = useState(0);
  const [violations, setViolations] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [modelId, setModelId] = useState("gpt-4o-mini");
  const [modelProvider, setModelProvider] = useState("openai");
  const [modelTier, setModelTier] = useState<RiskTier>("medium");

  const [promptId, setPromptId] = useState("support-system");
  const [promptTemplate, setPromptTemplate] = useState("You are a helpful support agent.");
  const [promptTier, setPromptTier] = useState<RiskTier>("low");

  const [toolId, setToolId] = useState("search_kb");
  const [toolName, setToolName] = useState("Search knowledge base");
  const [toolTier, setToolTier] = useState<RiskTier>("medium");

  const loadAll = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [reg, policies, viol] = await Promise.all([
        getGovernanceRegistry(token),
        listAiActionPolicies(token),
        getAiPolicyViolations(token),
      ]);
      setRegistry(reg.registry);
      setPolicyCount(policies.count ?? 0);
      setViolations(viol);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load AI governance"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleExport() {
    if (!token) return;
    setBusy("export");
    try {
      const evidence = await exportGovernanceEvidence(token);
      const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-governance-evidence-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("Evidence pack downloaded — attach to SOC 2 export.");
    } catch (err) {
      setError(messageFromUnknown(err, "Export failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleEvaluate(targetId: string, targetType: "model" | "prompt" | "tool") {
    if (!token) return;
    setBusy(`eval-${targetId}`);
    try {
      const result = await runGovernanceEvaluation(token, { targetId, targetType });
      setNotice(result.passed ? `Evaluation passed for ${targetId}` : `Evaluation failed for ${targetId}`);
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Evaluation failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell className="max-w-5xl">
      <ConsolePageHeader
        title="AI Governance"
        description="Model, prompt, and tool registry with risk tiers, pre-deploy evaluations, and SOC 2 evidence export."
        actions={
          <Button size="sm" variant="outline" disabled={!token || busy !== null} onClick={() => void handleExport()}>
            {busy === "export" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
            Export evidence
          </Button>
        }
      />

      <ConsoleFeedback error={error} notice={notice} />

      {token ? (
        <Panel className="mb-4 p-4 text-sm">
          <Link href="/ai-governance/eu-ai-act" className="font-medium underline-offset-2 hover:underline">
            EU AI Act compliance →
          </Link>
          <span className="text-muted-foreground"> — risk profiles, gap assessment, Annex IV export, runtime HITL enforcement.</span>
        </Panel>
      ) : null}

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">
          Admin JWT required — open <Link href="/projects" className="font-medium underline-offset-2 hover:underline">Projects</Link>.
        </Panel>
      ) : loading ? (
        <p className="text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Loading…</p>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-4">
            <Panel className="p-4 text-sm">
              <p className="text-muted-foreground">Models</p>
              <p className="text-2xl font-semibold">{registry?.models.length ?? 0}</p>
            </Panel>
            <Panel className="p-4 text-sm">
              <p className="text-muted-foreground">Prompts</p>
              <p className="text-2xl font-semibold">{registry?.prompts.length ?? 0}</p>
            </Panel>
            <Panel className="p-4 text-sm">
              <p className="text-muted-foreground">Tools</p>
              <p className="text-2xl font-semibold">{registry?.tools.length ?? 0}</p>
            </Panel>
            <Panel className="p-4 text-sm">
              <p className="text-muted-foreground">Action policies</p>
              <p className="text-2xl font-semibold">{policyCount}</p>
            </Panel>
          </div>

          {violations ? (
            <Panel className="p-4 text-xs text-muted-foreground">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
              Policy violations snapshot: {JSON.stringify(violations)}
            </Panel>
          ) : null}

          <Section title="Register model">
            <div className="grid gap-2 md:grid-cols-4">
              <Input value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="model id" />
              <Input value={modelProvider} onChange={(e) => setModelProvider(e.target.value)} placeholder="provider" />
              <select className="h-8 rounded-md border px-2 text-sm" value={modelTier} onChange={(e) => setModelTier(e.target.value as RiskTier)}>
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Button size="sm" disabled={busy !== null} onClick={async () => {
                if (!token) return;
                await registerGovernanceModel(token, { modelId, provider: modelProvider, riskTier: modelTier });
                setNotice("Model registered.");
                await loadAll();
              }}>Register</Button>
            </div>
            {registry?.models.length ? (
              <ul className="mt-4 divide-y rounded-lg border bg-white/90">
                {registry.models.map((m) => (
                  <li key={m.modelId} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                    <span>{m.modelId} · {m.provider} {tierBadge(m.riskTier)}</span>
                    <Button size="sm" variant="ghost" disabled={busy === `eval-${m.modelId}`} onClick={() => void handleEvaluate(m.modelId, "model")}>
                      <Play className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section title="Register prompt">
            <Input className="mb-2" value={promptId} onChange={(e) => setPromptId(e.target.value)} placeholder="prompt id" />
            <Textarea rows={3} value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value)} />
            <div className="mt-2 flex gap-2">
              <select className="h-8 rounded-md border px-2 text-sm" value={promptTier} onChange={(e) => setPromptTier(e.target.value as RiskTier)}>
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Button size="sm" disabled={busy !== null} onClick={async () => {
                if (!token) return;
                await registerGovernancePrompt(token, { promptId, template: promptTemplate, riskTier: promptTier });
                setNotice("Prompt registered.");
                await loadAll();
              }}>Register</Button>
            </div>
            {registry?.prompts.length ? (
              <ul className="mt-4 divide-y rounded-lg border bg-white/90">
                {registry.prompts.map((p) => (
                  <li key={p.promptId} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                    <span>{p.promptId} · {p.status} {tierBadge(p.riskTier)}</span>
                    <Button size="sm" variant="ghost" onClick={() => void handleEvaluate(p.promptId, "prompt")}><Play className="h-3 w-3" /></Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section title="Register tool">
            <div className="grid gap-2 md:grid-cols-4">
              <Input value={toolId} onChange={(e) => setToolId(e.target.value)} placeholder="tool id" />
              <Input value={toolName} onChange={(e) => setToolName(e.target.value)} placeholder="name" />
              <select className="h-8 rounded-md border px-2 text-sm" value={toolTier} onChange={(e) => setToolTier(e.target.value as RiskTier)}>
                {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Button size="sm" disabled={busy !== null} onClick={async () => {
                if (!token) return;
                await registerGovernanceTool(token, { toolId, name: toolName, riskTier: toolTier, requiresApproval: toolTier === "high" || toolTier === "critical" });
                setNotice("Tool registered.");
                await loadAll();
              }}>Register</Button>
            </div>
            {registry?.tools.length ? (
              <ul className="mt-4 divide-y rounded-lg border bg-white/90">
                {registry.tools.map((t) => (
                  <li key={t.toolId} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                    <span>{t.name} {tierBadge(t.riskTier)} {t.requiresApproval ? <Badge variant="outline">approval</Badge> : null}</span>
                    <Button size="sm" variant="ghost" onClick={() => void handleEvaluate(t.toolId, "tool")}><Play className="h-3 w-3" /></Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section title="Recent evaluations">
            {(registry?.evaluations ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Run pre-deploy evaluation from a registry row.</p>
            ) : (
              <ul className="space-y-2">
                {(registry?.evaluations ?? []).slice(0, 10).map((e: GovernanceEvaluation) => (
                  <li key={e.evaluationId} className="rounded border bg-white/80 p-3 text-xs">
                    <Badge variant={e.passed ? "outline" : "destructive"}>{e.passed ? "pass" : "fail"}</Badge>
                    {" "}{e.targetType}/{e.targetId} · score {e.score.toFixed(2)} · {e.evaluatedAt}
                    <p className="mt-1 text-muted-foreground">{e.evidence}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <p className="text-xs text-muted-foreground">
            Runtime enforcement: <code className="text-[11px]">POST /enterprise/ai-policies/check</code> · SOC 2 bundle:{" "}
            <Link href="/soc2" className="font-medium underline-offset-2 hover:underline">/soc2</Link>
          </p>
        </div>
      )}
    </ConsoleShell>
  );
}
