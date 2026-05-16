"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  FolderOpen,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { persistActiveProjectToClerk } from "@/lib/persist-active-project";
import { FormField } from "../components/form-field";
import { BILLING_STATUS_OPTIONS, PLAN_NAME_OPTIONS } from "@/lib/plan-options";
import { PUBLIC_PLAN_CATALOG } from "@/lib/plan-catalog";
import { isHostedCloudMode } from "@/lib/hosted-worker";
import { isPlatformOperatorProjectId } from "@/lib/platform-operator";
import { readJwtTenantId } from "@/lib/jwt-claims";
import { formatDateTime } from "@/lib/format-datetime";
import { formatNumber } from "@/lib/format-number";
import { cn } from "@/lib/utils";
import { Button, EmptyState, Input, Panel, SkeletonCard, Textarea } from "../components/ui";

import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const WORKER_URL = getPublicWorkerUrl();

type WorkspacePanel = "none" | "create" | "edit-plan" | "edit-name" | "session";

interface Project {
  id: string;
  name: string;
  created_at?: string;
  apiKey?: string;
  plan?: {
    planName: string;
    billingStatus: string;
    messageLimitMonthly: number;
    agentInvokeLimitMonthly: number;
    webhookDeliveryLimitMonthly: number;
    pricingVersion: string;
  } | null;
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default function ProjectsPage() {
  const { adminJwt, setAdminJwt, activeProject, setActiveProject, authHeader } =
    useDashboardSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<WorkspacePanel>("none");

  const [name, setName] = useState("");
  const [planName, setPlanName] = useState("free");
  const [billingStatus, setBillingStatus] = useState("manual");
  const [messageLimitMonthly, setMessageLimitMonthly] = useState(50000);
  const [agentInvokeLimitMonthly, setAgentInvokeLimitMonthly] = useState(1000);
  const [webhookDeliveryLimitMonthly, setWebhookDeliveryLimitMonthly] = useState(10000);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedProject =
    projects.find((p) => p.id === selectedId) ??
  (activeProject?.id ? projects.find((p) => p.id === activeProject.id) : null) ??
    null;

  const isDashboardActive = activeProject?.id === selectedProject?.id;
  const sessionTenantId = readJwtTenantId(adminJwt);
  const isPlatformOperator = isPlatformOperatorProjectId(sessionTenantId);
  const hostedCloud = isHostedCloudMode();
  const canManageTenantPlans = !hostedCloud || isPlatformOperator;
  const canCreateProjects = canManageTenantPlans;
  const canRenameProject = Boolean(adminJwt.trim() && selectedProject?.id);

  const selectedPlanCatalog = PUBLIC_PLAN_CATALOG[planName] ?? PUBLIC_PLAN_CATALOG.free;

  const syncPlanFormFromProject = useCallback((project: Project | null) => {
    if (!project?.plan) return;
    setPlanName(project.plan.planName || "free");
    setBillingStatus(project.plan.billingStatus || "manual");
    setMessageLimitMonthly(project.plan.messageLimitMonthly || 50000);
    setAgentInvokeLimitMonthly(project.plan.agentInvokeLimitMonthly || 1000);
    setWebhookDeliveryLimitMonthly(project.plan.webhookDeliveryLimitMonthly || 10000);
  }, []);

  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const selectProject = useCallback((project: Project) => {
    setSelectedId(project.id);
    syncPlanFormFromProject(project);
    setPanel("none");
    setError(null);
    setNotice(null);
  }, [syncPlanFormFromProject]);

  const load = useCallback(async () => {
    if (!adminJwt.trim()) {
      setError("Paste an admin JWT under Session settings to load projects.");
      setProjects([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const json = await fetchWorkerJson<{ projects?: Project[] }>(`${WORKER_URL}/admin/projects`, {
        headers: authHeader(adminJwt),
      });
      const list: Project[] = json.projects || [];
      setProjects(list);
      const sid = selectedIdRef.current;
      if (sid && !list.some((p) => p.id === sid)) {
        setSelectedId(null);
      }
      if (!sid && list.length === 1) {
        selectProject(list[0]);
      }
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [adminJwt, authHeader, selectProject]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (activeProject?.id && projects.some((p) => p.id === activeProject.id)) {
      setSelectedId(activeProject.id);
      syncPlanFormFromProject(
        projects.find((p) => p.id === activeProject.id) ?? activeProject,
      );
    }
  }, [activeProject?.id, projects, syncPlanFormFromProject]);

  const createProject = async () => {
    if (!adminJwt.trim() || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchWorkerJson<{ project: Project }>(`${WORKER_URL}/admin/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader(adminJwt) || {}),
        },
        body: JSON.stringify({ name: name.trim() }),
      });
      setProjects((prev) => [...prev, json.project]);
      setActiveProject(json.project);
      void persistActiveProjectToClerk(json.project);
      selectProject(json.project);
      setName("");
      setPanel("none");
      setNotice(`Created “${json.project.name}” and set it as the active dashboard project.`);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const renameProject = async () => {
    if (!adminJwt.trim() || !selectedProject?.id || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchWorkerJson<{ project: Project }>(
        `${WORKER_URL}/admin/projects/${selectedProject.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(authHeader(adminJwt) || {}),
          },
          body: JSON.stringify({ name: name.trim() }),
        },
      );
      setProjects((prev) =>
        prev.map((p) => (p.id === selectedProject.id ? { ...p, ...json.project } : p)),
      );
      if (activeProject?.id === selectedProject.id) {
        setActiveProject({ ...activeProject, ...json.project });
        void persistActiveProjectToClerk({ ...activeProject, ...json.project });
      }
      setPanel("none");
      setNotice(`Renamed to “${json.project.name}”.`);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const savePlan = async () => {
    if (!adminJwt.trim() || !selectedProject?.id) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchWorkerJson<{ plan: NonNullable<Project["plan"]> }>(
        `${WORKER_URL}/admin/projects/${selectedProject.id}/plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authHeader(adminJwt) || {}),
          },
          body: JSON.stringify({
            planName,
            billingStatus,
            pricingVersion: "v1",
          }),
        }
      );
      const updated = { ...selectedProject, plan: json.plan };
      setProjects((prev) =>
        prev.map((p) => (p.id === selectedProject.id ? updated : p)),
      );
      if (activeProject?.id === selectedProject.id) {
        setActiveProject(updated);
      }
      syncPlanFormFromProject(updated);
      setPanel("none");
      setNotice("Plan and quotas saved.");
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  function activateForDashboard() {
    if (!selectedProject) return;
    setActiveProject(selectedProject);
    void persistActiveProjectToClerk(selectedProject);
    setNotice(`“${selectedProject.name}” is now the active project for Agents, Rooms, and Analytics.`);
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Projects"
        description="One project = one tenant. Select on the left, then create or edit when something changes."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanel(panel === "session" ? "none" : "session")}
          >
            <Settings2 className="mr-1.5 h-4 w-4" />
            Session
          </Button>
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200/80 bg-red-50 p-3 text-sm text-red-950">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4 rounded-xl border border-emerald-200/80 bg-emerald-50 p-3 text-sm text-emerald-950">
          {notice}
        </div>
      ) : null}
      {hostedCloud && !isPlatformOperator ? (
        <div className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50 p-3 text-sm text-amber-950">
          Hosted cloud includes one project per account — use <strong>Rename</strong> to change its display name.
          Plan tiers and quotas are managed by the platform; use{" "}
          <a href="/billing" className="font-medium underline underline-offset-2">
            Billing
          </a>{" "}
          to upgrade when card checkout is enabled.
        </div>
      ) : null}

      {panel === "session" ? (
        <Panel className="mb-6 rounded-2xl border border-border/80 p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-semibold">Admin session</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Owner/admin JWT used by Projects, Agents, Analytics, and Onboarding. Never put this
                token in a customer-facing app.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPanel("none")} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            value={adminJwt}
            onChange={(e) => setAdminJwt(e.target.value)}
            rows={4}
            placeholder="Paste admin JWT…"
            className="font-mono text-xs"
          />
          <Button variant="neutral" className="mt-3" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            {loading ? "Loading…" : "Reload projects"}
          </Button>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,300px)_1fr]">
        {/* —— Project list —— */}
        <aside className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your projects
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh list"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>

          {canCreateProjects ? (
            <Button
              variant={panel === "create" ? "neutral" : "outline"}
              className="w-full justify-start"
              onClick={() => {
                setPanel(panel === "create" ? "none" : "create");
                setError(null);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New project
            </Button>
          ) : null}

          {loading && projects.length === 0 ? (
            <div className="flex flex-col gap-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : null}

          {projects.length === 0 && !loading ? (
            <EmptyState
              icon={FolderOpen}
              title="No projects"
              description="Click New project to add your first tenant."
            />
          ) : null}

          <ul className="flex flex-col gap-1.5">
            {projects.map((p) => {
              const isSelected = selectedId === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => selectProject(p)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                      isSelected
                        ? "border-brand/40 bg-brand/5 ring-1 ring-brand/20"
                        : "border-border/60 bg-white/80 hover:border-border hover:bg-muted/30",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-foreground">{p.name}</span>
                      {activeProject?.id === p.id ? (
                        <Badge variant="success" className="shrink-0 text-[10px]">
                          Active
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                      {p.id}
                    </p>
                    {p.plan ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {p.plan.planName} · {p.plan.billingStatus}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-xs text-amber-700">No plan configured</p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* —— Detail / editor —— */}
        <main className="min-w-0">
          {panel === "create" ? (
            <Panel className="rounded-2xl border border-border/80 p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-xl font-semibold">Create project</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A new tenant with its own API keys, rooms, and quotas.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPanel("none")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <FormField label="Project name" hint="Shown in the console and in JWT tenant claims.">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Corp"
                  autoFocus
                />
              </FormField>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  className="bg-brand text-white hover:bg-[#e8614d]"
                  onClick={() => void createProject()}
                  disabled={loading || !name.trim()}
                >
                  {loading ? "Creating…" : "Create project"}
                </Button>
                <Button variant="ghost" onClick={() => setPanel("none")}>
                  Cancel
                </Button>
              </div>
            </Panel>
          ) : null}

          {panel === "edit-name" && selectedProject ? (
            <Panel className="rounded-2xl border border-border/80 p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-xl font-semibold">Rename project</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Updates the display name for <strong>{selectedProject.id}</strong>.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPanel("none")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <FormField label="Project name" hint="Shown in the console and in JWT tenant claims.">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Corp"
                  autoFocus
                />
              </FormField>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  className="bg-brand text-white hover:bg-[#e8614d]"
                  onClick={() => void renameProject()}
                  disabled={loading || !name.trim()}
                >
                  {loading ? "Saving…" : "Save name"}
                </Button>
                <Button variant="ghost" onClick={() => setPanel("none")}>
                  Cancel
                </Button>
              </div>
            </Panel>
          ) : null}

          {panel === "edit-plan" && selectedProject && canManageTenantPlans ? (
            <Panel className="rounded-2xl border border-border/80 p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-xl font-semibold">Plan & quotas</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Editing <strong>{selectedProject.name}</strong>. Limits are fixed per plan tier
                    on the server.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPanel("none")}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Plan tier">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                  >
                    {!PLAN_NAME_OPTIONS.some((o) => o.value === planName) && planName ? (
                      <option value={planName}>{planName}</option>
                    ) : null}
                    {PLAN_NAME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Billing status">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={billingStatus}
                    onChange={(e) => setBillingStatus(e.target.value)}
                  >
                    {!BILLING_STATUS_OPTIONS.some((o) => o.value === billingStatus) &&
                    billingStatus ? (
                      <option value={billingStatus}>{billingStatus}</option>
                    ) : null}
                    {BILLING_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <div className="sm:col-span-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{selectedPlanCatalog.label} limits</p>
                  <ul className="mt-2 space-y-1">
                    <li>Messages / month: {formatNumber(selectedPlanCatalog.messages)}</li>
                    <li>Agent invokes / month: {formatNumber(selectedPlanCatalog.agents)}</li>
                    <li>Webhook deliveries / month: {formatNumber(selectedPlanCatalog.webhooks)}</li>
                  </ul>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button variant="neutral" onClick={() => void savePlan()} disabled={loading}>
                  {loading ? "Saving…" : "Save changes"}
                </Button>
                <Button variant="ghost" onClick={() => setPanel("none")}>
                  Cancel
                </Button>
              </div>
            </Panel>
          ) : null}

          {panel === "none" && selectedProject ? (
            <Panel className="rounded-2xl border border-border/80 p-6">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-2xl font-semibold tracking-tight">
                      {selectedProject.name}
                    </h2>
                    {isDashboardActive ? (
                      <Badge variant="success">Dashboard active</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{selectedProject.id}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Created{" "}
                    {selectedProject.created_at
                      ? formatDateTime(selectedProject.created_at)
                      : "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!isDashboardActive ? (
                    <Button variant="neutral" size="sm" onClick={activateForDashboard}>
                      Use in dashboard
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  ) : null}
                  {canRenameProject ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setName(selectedProject.name);
                        setPanel("edit-name");
                      }}
                    >
                      <Pencil className="mr-1.5 h-4 w-4" />
                      Rename
                    </Button>
                  ) : null}
                  {canManageTenantPlans ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        syncPlanFormFromProject(selectedProject);
                        setPanel("edit-plan");
                      }}
                    >
                      <Pencil className="mr-1.5 h-4 w-4" />
                      Edit plan
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Subscription
                  </h3>
                  {selectedProject.plan ? (
                    <>
                      <StatRow
                        label="Plan"
                        value={
                          <Badge variant="secondary">{selectedProject.plan.planName}</Badge>
                        }
                      />
                      <StatRow
                        label="Billing"
                        value={
                          <Badge variant="outline">{selectedProject.plan.billingStatus}</Badge>
                        }
                      />
                      <StatRow
                        label="Pricing version"
                        value={selectedProject.plan.pricingVersion}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {canManageTenantPlans
                        ? "No plan on file. Use Edit plan to assign a tier."
                        : "No plan on file. Upgrade from Billing when payments are enabled."}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Monthly quotas
                  </h3>
                  {selectedProject.plan ? (
                    <>
                      <StatRow
                        label="Messages"
                        value={formatNumber(selectedProject.plan.messageLimitMonthly)}
                      />
                      <StatRow
                        label="Agent invokes"
                        value={formatNumber(selectedProject.plan.agentInvokeLimitMonthly)}
                      />
                      <StatRow
                        label="Webhook deliveries"
                        value={formatNumber(selectedProject.plan.webhookDeliveryLimitMonthly)}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              </div>

              {selectedProject.apiKey ? (
                <div className="mt-6 rounded-xl border border-dashed border-border/80 bg-background p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    Bootstrap API key
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    Shown once at creation. Use it on your backend to mint member JWTs — never ship
                    admin tokens to browsers.
                  </p>
                  <code className="block break-all rounded-md border border-border bg-[#0d1117] px-3 py-2 font-mono text-xs text-[#e6edf3]">
                    {selectedProject.apiKey}
                  </code>
                </div>
              ) : null}
            </Panel>
          ) : null}

          {panel === "none" && !selectedProject ? (
            <Panel className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-8 text-center">
              <FolderOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <h2 className="font-heading text-lg font-medium">Select a project</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Choose a tenant from the list, or create one with <strong>New project</strong>.
              </p>
              {!adminJwt.trim() ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => setPanel("session")}
                >
                  <Settings2 className="mr-1.5 h-4 w-4" />
                  Open session settings
                </Button>
              ) : null}
            </Panel>
          ) : null}
        </main>
      </div>
    </ConsoleShell>
  );
}
