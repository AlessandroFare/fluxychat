"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, Loader2, Scale, ShieldCheck } from "lucide-react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { useDashboardSession } from "../../components/dashboard-session";
import { Banner, Button, Input, Panel, Section, Textarea } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { messageFromUnknown } from "@/lib/error-message";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import {
  exportEuAiActTechnicalDocumentation,
  getEuAiActAssessment,
  getEuAiActSettings,
  listEuAiActProfiles,
  updateEuAiActSettings,
  upsertEuAiActProfile,
  type AgentEuAiActProfile,
  type AnnexIIICategory,
  type EuAiActAssessment,
  type EuAiActGap,
  type EuAiActSettings,
  type EuRiskCategory,
  type HitlMode,
  type HumanOversightLevel,
} from "@/lib/eu-ai-act-client";

const RISK_CATEGORIES: EuRiskCategory[] = ["minimal", "limited", "high", "unacceptable"];
const HITL_MODES: HitlMode[] = ["none", "side_effect", "all_tools"];
const OVERSIGHT_LEVELS: HumanOversightLevel[] = ["human_in_loop", "human_on_loop", "human_in_command"];

function severityBadge(severity: EuAiActGap["severity"]) {
  if (severity === "critical") return <Badge variant="destructive">critical</Badge>;
  if (severity === "high") return <Badge variant="destructive">high</Badge>;
  if (severity === "medium") return <Badge variant="secondary">medium</Badge>;
  return <Badge variant="outline">{severity}</Badge>;
}

function riskBadge(category: EuRiskCategory) {
  if (category === "unacceptable" || category === "high") return <Badge variant="destructive">{category}</Badge>;
  if (category === "limited") return <Badge variant="secondary">{category}</Badge>;
  return <Badge variant="outline">{category}</Badge>;
}

export default function EuAiActCompliancePage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [settings, setSettings] = useState<EuAiActSettings | null>(null);
  const [annexCategories, setAnnexCategories] = useState<AnnexIIICategory[]>([]);
  const [assessment, setAssessment] = useState<EuAiActAssessment | null>(null);
  const [profiles, setProfiles] = useState<AgentEuAiActProfile[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [intendedPurpose, setIntendedPurpose] = useState("");
  const [euRiskCategory, setEuRiskCategory] = useState<EuRiskCategory>("minimal");
  const [annexIIICategory, setAnnexIIICategory] = useState("none");
  const [humanOversightLevel, setHumanOversightLevel] = useState<HumanOversightLevel>("human_in_loop");
  const [hitlMode, setHitlMode] = useState<HitlMode>("side_effect");
  const [requiresDisclosure, setRequiresDisclosure] = useState(true);
  const [conformityAssessed, setConformityAssessed] = useState(false);

  const profileByAgent = useMemo(
    () => new Map(profiles.map((p) => [p.agentId, p])),
    [profiles],
  );

  const loadAll = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const client = new FluxyChatClient({ baseUrl: getPublicWorkerUrl(), userId: "console", token });
      const [settingsRes, assessmentRes, profilesRes, agentList] = await Promise.all([
        getEuAiActSettings(token),
        getEuAiActAssessment(token),
        listEuAiActProfiles(token),
        client.listAgents().catch(() => []),
      ]);
      setSettings(settingsRes.settings);
      setAnnexCategories(settingsRes.annexIIICategories ?? []);
      setAssessment(assessmentRes.assessment);
      setProfiles(profilesRes.profiles);
      setAgents(agentList.map((a) => ({ id: a.id, name: a.name ?? a.id })));
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load EU AI Act compliance data"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedAgentId) return;
    const existing = profileByAgent.get(selectedAgentId);
    if (existing) {
      setIntendedPurpose(existing.intendedPurpose);
      setEuRiskCategory(existing.euRiskCategory);
      setAnnexIIICategory(existing.annexIIICategory ?? "none");
      setHumanOversightLevel(existing.humanOversightLevel);
      setHitlMode(existing.hitlMode);
      setRequiresDisclosure(existing.requiresDisclosure);
      setConformityAssessed(existing.conformityAssessed);
    } else {
      setIntendedPurpose("");
      setEuRiskCategory("minimal");
      setAnnexIIICategory("none");
      setHumanOversightLevel("human_in_loop");
      setHitlMode("side_effect");
      setRequiresDisclosure(true);
      setConformityAssessed(false);
    }
  }, [selectedAgentId, profileByAgent]);

  async function handleSaveSettings() {
    if (!token || !settings) return;
    setBusy("settings");
    try {
      const res = await updateEuAiActSettings(token, {
        providerLegalName: settings.providerLegalName ?? undefined,
        providerContact: settings.providerContact ?? undefined,
        enforceAiDisclosure: settings.enforceAiDisclosure,
        enforceHitlHighRisk: settings.enforceHitlHighRisk,
        recordRetentionDays: settings.recordRetentionDays,
        requireConformityForHighRisk: settings.requireConformityForHighRisk,
        blockUnacceptableRisk: settings.blockUnacceptableRisk,
        enabled: settings.enabled,
      });
      setSettings(res.settings);
      setNotice("Project EU AI Act settings saved.");
      const assessmentRes = await getEuAiActAssessment(token);
      setAssessment(assessmentRes.assessment);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save settings"));
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveProfile() {
    if (!token || !selectedAgentId || !intendedPurpose.trim()) return;
    setBusy("profile");
    try {
      await upsertEuAiActProfile(token, selectedAgentId, {
        intendedPurpose: intendedPurpose.trim(),
        euRiskCategory,
        annexIIICategory: annexIIICategory === "none" ? null : annexIIICategory,
        humanOversightLevel,
        hitlMode,
        requiresDisclosure,
        conformityAssessed,
        prohibitedUseConfirmed: true,
      });
      setNotice("Agent compliance profile saved.");
      await loadAll();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save agent profile"));
    } finally {
      setBusy(null);
    }
  }

  async function handleExportDoc() {
    if (!token) return;
    setBusy("doc");
    try {
      const doc = await exportEuAiActTechnicalDocumentation(token);
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eu-ai-act-annex-iv-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("Annex IV technical documentation downloaded.");
    } catch (err) {
      setError(messageFromUnknown(err, "Export failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell className="max-w-5xl">
      <ConsolePageHeader
        title="EU AI Act compliance"
        description="Risk classification, human oversight enforcement, transparency, and Annex IV documentation (Regulation 2024/1689)."
        icon={Scale}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!token || busy !== null} onClick={() => void loadAll()}>
              Refresh
            </Button>
            <Button size="sm" variant="outline" disabled={!token || busy !== null} onClick={() => void handleExportDoc()}>
              {busy === "doc" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1 h-3.5 w-3.5" />}
              Annex IV export
            </Button>
          </div>
        }
      />

      <Banner variant="info" className="mb-4">
        Technical controls only, not legal advice. Pair with counsel for formal conformity assessment.
        See also{" "}
        <Link href="/ai-governance" className="underline">
          AI Governance registry
        </Link>
        .
      </Banner>

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">
          Admin JWT required. Open{" "}
          <Link href="/projects" className="font-medium underline-offset-2 hover:underline">
            Projects
          </Link>
          .
        </Panel>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
          Loading compliance assessment…
        </p>
      ) : (
        <div className="space-y-8">
          {assessment ? (
            <Panel className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Compliance score</p>
                  <p className="text-3xl font-semibold">{assessment.score}/100</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {assessment.summary.agents} agents · {assessment.summary.profiles} profiles · {assessment.summary.gaps} gaps
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {assessment.readyForProduction ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-700">No blocking gaps</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <span className="text-sm font-medium text-amber-700">
                        {assessment.summary.critical} critical · {assessment.summary.high} high severity
                      </span>
                    </>
                  )}
                </div>
              </div>
              {assessment.gaps.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {assessment.gaps.map((gap) => (
                    <li key={gap.id} className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        {severityBadge(gap.severity)}
                        <span className="font-medium">{gap.title}</span>
                        <Badge variant="outline">{gap.article}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{gap.detail}</p>
                      <Link href={gap.fixPath} className="mt-1 inline-block text-xs font-medium underline">
                        Fix →
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">All automated checks passed for this project.</p>
              )}
            </Panel>
          ) : null}

          <Section title="Provider & project settings">
            {settings ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground">Provider legal name</label>
                  <Input
                    className="mt-1"
                    value={settings.providerLegalName ?? ""}
                    onChange={(e) => setSettings({ ...settings, providerLegalName: e.target.value })}
                    placeholder="Your company legal name"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Provider contact</label>
                  <Input
                    className="mt-1"
                    value={settings.providerContact ?? ""}
                    onChange={(e) => setSettings({ ...settings, providerContact: e.target.value })}
                    placeholder="compliance@company.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Record retention (days)</label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={30}
                    max={3650}
                    value={settings.recordRetentionDays}
                    onChange={(e) =>
                      setSettings({ ...settings, recordRetentionDays: Number(e.target.value) || 365 })
                    }
                  />
                </div>
                <div className="flex flex-col justify-end gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.enforceAiDisclosure}
                      onChange={(e) => setSettings({ ...settings, enforceAiDisclosure: e.target.checked })}
                    />
                    Enforce AI disclosure (Art. 50)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.enforceHitlHighRisk}
                      onChange={(e) => setSettings({ ...settings, enforceHitlHighRisk: e.target.checked })}
                    />
                    Enforce HITL for high-risk agents (Art. 14)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.requireConformityForHighRisk}
                      onChange={(e) => setSettings({ ...settings, requireConformityForHighRisk: e.target.checked })}
                    />
                    Block high-risk agents without conformity sign-off (Art. 43)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.blockUnacceptableRisk}
                      onChange={(e) => setSettings({ ...settings, blockUnacceptableRisk: e.target.checked })}
                    />
                    Block unacceptable-risk agents at runtime
                  </label>
                </div>
                <div className="md:col-span-2">
                  <Button size="sm" disabled={busy === "settings"} onClick={() => void handleSaveSettings()}>
                    {busy === "settings" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                    Save project settings
                  </Button>
                </div>
              </div>
            ) : null}
          </Section>

          <Section title="Agent risk profiles">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-muted-foreground">Agent</label>
                <select
                  className="mt-1 h-9 w-full rounded-md border px-2 text-sm"
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                >
                  <option value="">Select agent…</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} {profileByAgent.has(a.id) ? "✓" : "(no profile)"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">EU risk category</label>
                <select
                  className="mt-1 h-9 w-full rounded-md border px-2 text-sm"
                  value={euRiskCategory}
                  onChange={(e) => setEuRiskCategory(e.target.value as EuRiskCategory)}
                >
                  {RISK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground">Intended purpose (required)</label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={intendedPurpose}
                  onChange={(e) => setIntendedPurpose(e.target.value)}
                  placeholder="e.g. Internal support triage, not used for hiring decisions"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Annex III category (if high-risk)</label>
                <select
                  className="mt-1 h-9 w-full rounded-md border px-2 text-sm"
                  value={annexIIICategory}
                  onChange={(e) => setAnnexIIICategory(e.target.value)}
                >
                  {annexCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Human oversight level</label>
                <select
                  className="mt-1 h-9 w-full rounded-md border px-2 text-sm"
                  value={humanOversightLevel}
                  onChange={(e) => setHumanOversightLevel(e.target.value as HumanOversightLevel)}
                >
                  {OVERSIGHT_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">HITL mode (runtime enforcement)</label>
                <select
                  className="mt-1 h-9 w-full rounded-md border px-2 text-sm"
                  value={hitlMode}
                  onChange={(e) => setHitlMode(e.target.value as HitlMode)}
                >
                  {HITL_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col justify-end gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={requiresDisclosure}
                    onChange={(e) => setRequiresDisclosure(e.target.checked)}
                  />
                  Require AI disclosure in messages
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={conformityAssessed}
                    onChange={(e) => setConformityAssessed(e.target.checked)}
                  />
                  Conformity assessed (internal sign-off)
                </label>
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={!selectedAgentId || !intendedPurpose.trim() || busy === "profile"}
                  onClick={() => void handleSaveProfile()}
                >
                  {busy === "profile" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Save agent profile
                </Button>
                {selectedAgentId && profileByAgent.get(selectedAgentId) ? (
                  riskBadge(profileByAgent.get(selectedAgentId)!.euRiskCategory)
                ) : null}
              </div>
            </div>

            {profiles.length > 0 ? (
              <ul className="mt-4 divide-y rounded-lg border bg-white/90">
                {profiles.map((p) => {
                  const agent = agents.find((a) => a.id === p.agentId);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                      <span>
                        {agent?.name ?? p.agentId}: {p.intendedPurpose.slice(0, 60)}
                        {p.intendedPurpose.length > 60 ? "…" : ""}
                      </span>
                      <div className="flex items-center gap-2">
                        {riskBadge(p.euRiskCategory)}
                        {p.conformityAssessed ? (
                          <Badge variant="default">
                            <ShieldCheck className="mr-1 h-3 w-3" />
                            conformity
                          </Badge>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </Section>
        </div>
      )}
    </ConsoleShell>
  );
}
