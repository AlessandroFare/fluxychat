"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CheckCircle2, Globe, Package, Puzzle, Search, Star, Store,
  Plus, Trash2, Download, Key, Cpu, Layers, Zap, ArrowUpRight,
  Bot, Sparkles, MessageSquare, Shield, BookOpen, Code, Boxes,
  Loader2, X, AlertCircle, ChevronDown,
} from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "~/components/ui/dialog";
import { createAppMarketplace, type AppManifest } from "@fluxy-chat/sdk";
import { createProviderMarketplace, type LlmProvider, type LlmModel } from "@fluxy-chat/sdk";
import { useDashboardSession } from "../components/dashboard-session";
import { useClerkUser } from "@/lib/clerk-user";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { messageFromUnknown } from "@/lib/error-message";
import {
  listMarketplaceAgents,
  getMarketplaceStats,
  installMarketplaceAgent,
  uninstallMarketplaceAgent,
  listInstalledMarketplaceAgents,
  createAgentFromTemplate,
  publishMarketplaceAgent,
  submitMarketplaceAgentForReview,
  reviewMarketplaceAgent,
  listPublisherMarketplaceAgents,
  type MarketplaceAgent,
  type MarketplaceInstall,
  type MarketplaceStats,
} from "@/lib/marketplace-client";
import {
  installMcpApp,
  listInstalledMcpApps,
  listMcpAppsCatalog,
  uninstallMcpApp,
  type McpAppCatalogEntry,
  type McpAppInstall,
} from "@/lib/mcp-apps-client";

/* ─── Provider helpers ─── */

interface ProviderKey { id: string; providerId: string; key: string; label?: string; isActive: boolean; }

const BUILTIN_PROVIDERS: LlmProvider[] = [
  { id: "openai", name: "OpenAI", models: [
    { id: "gpt-4o", name: "GPT-4o", providerId: "openai", capabilities: ["chat", "vision", "function_calling"], maxTokens: 128000, costPer1kInput: 0.005, costPer1kOutput: 0.015 },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", providerId: "openai", capabilities: ["chat", "function_calling"], maxTokens: 128000, costPer1kInput: 0.00015, costPer1kOutput: 0.0006 },
    { id: "o3", name: "o3", providerId: "openai", capabilities: ["chat", "reasoning"], maxTokens: 200000, costPer1kInput: 0.01, costPer1kOutput: 0.04 },
  ], supportsStreaming: true, requiresApiKey: true, docsUrl: "https://platform.openai.com/docs" },
  { id: "anthropic", name: "Anthropic", models: [
    { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet", providerId: "anthropic", capabilities: ["chat", "vision", "function_calling"], maxTokens: 200000, costPer1kInput: 0.003, costPer1kOutput: 0.015 },
    { id: "claude-3.5-haiku", name: "Claude 3.5 Haiku", providerId: "anthropic", capabilities: ["chat", "vision"], maxTokens: 200000, costPer1kInput: 0.0008, costPer1kOutput: 0.004 },
  ], supportsStreaming: true, requiresApiKey: true, docsUrl: "https://docs.anthropic.com" },
  { id: "google", name: "Google", models: [
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", providerId: "google", capabilities: ["chat", "vision", "multimodal"], maxTokens: 1000000, costPer1kInput: 0.0001, costPer1kOutput: 0.0004 },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", providerId: "google", capabilities: ["chat", "vision", "reasoning"], maxTokens: 2000000, costPer1kInput: 0.00125, costPer1kOutput: 0.005 },
  ], supportsStreaming: true, requiresApiKey: true, docsUrl: "https://ai.google.dev/docs" },
];

/* ─── Page layout ─── */

export default function MarketplacePage() {
  const [tab, setTab] = useState<"apps" | "templates" | "providers" | "mcp-apps">("apps");

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Marketplace"
        description="Publish, browse, and install agent templates, apps, and AI providers."
      />

      <div role="tablist" className="mt-6 flex gap-1 border-b border-border">
        {([
          { id: "apps", label: "App Marketplace", icon: Package },
          { id: "templates", label: "Agent Templates", icon: Puzzle },
          { id: "mcp-apps", label: "MCP Apps", icon: Boxes },
          { id: "providers", label: "AI Providers", icon: Cpu },
        ] as const).map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className="-mb-px flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ borderColor: tab === t.id ? "var(--fluxy-cta-color)" : "transparent", color: tab === t.id ? "var(--foreground)" : "var(--muted-foreground)" }}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-6">
        {tab === "apps" && <AppMarketplaceTab />}
        {tab === "templates" && <AgentTemplateGallery />}
        {tab === "mcp-apps" && <McpAppsMarketplaceTab />}
        {tab === "providers" && <ProviderMarketplaceTab />}
      </div>
    </ConsoleShell>
  );
}

/* ─── Apps (SDK demo) ─── */

function AppMarketplaceTab() {
  const [store] = useState(() => createAppMarketplace());
  const [apps, setApps] = useState<AppManifest[]>([]);
  const [appName, setAppName] = useState("");
  const [appGrants, setAppGrants] = useState("chat:write");
  const [installMsg, setInstallMsg] = useState("");
  const [search, setSearch] = useState("");
  const [installed, setInstalled] = useState<Set<string>>(new Set());

  function handlePublish() {
    if (!appName.trim()) return;
    const manifest: AppManifest = {
      appId: `app-${Date.now()}`,
      name: appName.trim(),
      version: "1.0.0",
      description: `App ${appName.trim()}`,
      developer: "demo-user",
      permissions: appGrants.split(",").map((g) => g.trim() as any),
      createdAt: Date.now(),
    };
    store.submitManifest(manifest);
    store.approveApp(manifest.appId, "demo-reviewer");
    setApps(store.getInstalledApps("demo-tenant").length > 0 ? [manifest] : [manifest]);
    setAppName("");
    setAppGrants("chat:write");
  }

  const filtered = search ? apps.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())) : apps;

  return (
    <div className="space-y-6">
      <Panel className="p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Package className="h-4 w-4" /> Publish a new app
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="App name" className="max-w-[160px]" />
          <Input value={appGrants} onChange={(e) => setAppGrants(e.target.value)} placeholder="grants: chat:write, chat:read" className="max-w-[200px] font-mono text-xs" />
          <Button onClick={handlePublish} size="sm">Publish + approve</Button>
        </div>
      </Panel>

      <div className="flex gap-2 items-center">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search apps..." className="max-w-xs" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <p className="col-span-full text-sm text-muted-foreground">{apps.length === 0 ? "No published apps yet. Create one above." : "No matches."}</p>
        ) : filtered.map((a) => {
          const isInstalled = installed.has(a.appId);
          return (
            <Panel key={a.appId} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="flex items-center gap-1.5 text-sm font-medium">
                    <Store className="h-3.5 w-3.5" /> {a.name}
                  </h4>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                  <p className="text-xs text-muted-foreground">v{a.version}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {a.permissions.map((g) => (
                      <Badge key={g} variant="outline" className="text-[9px]">{g}</Badge>
                    ))}
                  </div>
                </div>
                <Button size="sm" variant={isInstalled ? "secondary" : "outline"}
                  onClick={() => {
                    if (isInstalled) return;
                    store.installApp(a.appId, "demo-tenant", "demo-user");
                    setInstalled((p) => new Set([...p, a.appId]));
                    setInstallMsg(`"${a.name}" installed`);
                  }}>
                  {isInstalled ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Installed</> : <><Download className="h-3 w-3 mr-1" /> Install</>}
                </Button>
              </div>
            </Panel>
          );
        })}
      </div>
      {installMsg && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 className="h-3 w-3" /> {installMsg}</p>
      )}
    </div>
  );
}

/* ─── Agent Template Gallery (production) ─── */

const CATEGORIES = ["general", "support", "onboarding", "moderation", "analytics", "sales", "developer", "productivity"];
const SORT_OPTIONS = [
  { value: "", label: "Popular" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name A-Z" },
];

const CATEGORY_ICONS: Record<string, typeof Bot> = {
  general: Bot,
  support: MessageSquare,
  onboarding: BookOpen,
  moderation: Shield,
  analytics: Layers,
  sales: Zap,
  developer: Code,
  productivity: Sparkles,
};

function AgentTemplateGallery() {
  const { adminJwt, memberJwt, activeProject } = useDashboardSession();
  const { user: clerkUser } = useClerkUser();
  const memberUserId = clerkUser?.id ? fluxyUserIdFromClerk(clerkUser.id) : "dashboard";
  const token = (adminJwt || memberJwt).trim();

  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<MarketplaceAgent | null>(null);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [showPublish, setShowPublish] = useState(false);
  const [pubName, setPubName] = useState("");
  const [pubSlug, setPubSlug] = useState("");
  const [pubDescription, setPubDescription] = useState("");
  const [pubCategory, setPubCategory] = useState("general");
  const [pubSystemPrompt, setPubSystemPrompt] = useState("");
  const [pubVersion, setPubVersion] = useState("1.0.0");
  const [publishing, setPublishing] = useState(false);
  const [myAgents, setMyAgents] = useState<MarketplaceAgent[]>([]);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const [agentList, marketplaceStats] = await Promise.all([
        listMarketplaceAgents({
          category: category || undefined,
          search: search || undefined,
          sort: sort || undefined,
          token: token || undefined,
        }),
        getMarketplaceStats(token || undefined),
      ]);
      setAgents(agentList);
      setStats(marketplaceStats);

      if (token) {
        const [installed, publisherAgents] = await Promise.all([
          listInstalledMarketplaceAgents(token),
          listPublisherMarketplaceAgents(token),
        ]);
        setInstalledIds(new Set(installed.map((i) => i.agentId)));
        setMyAgents(publisherAgents);
      }
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load marketplace"));
    } finally {
      setLoading(false);
    }
  }, [category, search, sort, token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredAgents = useMemo(() => {
    let result = agents;
    if (category) result = result.filter((a) => a.category === category);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) => a.name.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q));
    }
    if (sort === "rating") result = [...result].sort((a, b) => b.avgRating - a.avgRating);
    else if (sort === "newest") result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sort === "name") result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    else result = [...result].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.installCount - a.installCount);
    return result;
  }, [agents, category, search, sort]);

  const handlePublish = async () => {
    if (!token) {
      setError("Admin JWT required. Configure a project first.");
      return;
    }
    if (!pubName.trim() || !pubSlug.trim()) {
      setError("Name and slug are required.");
      return;
    }
    setPublishing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await publishMarketplaceAgent(token, {
        name: pubName.trim(),
        slug: pubSlug.trim().toLowerCase().replace(/\s+/g, "-"),
        description: pubDescription || undefined,
        category: pubCategory,
        systemPrompt: pubSystemPrompt || undefined,
        version: pubVersion,
        configTemplate: { model: "gpt-4o-mini", provider: "openai" },
        tags: ["dashboard"],
      });
      setSuccessMsg(`Template "${pubName}" created as draft (${result.id}). Submit for review when ready.`);
      setPubName("");
      setPubSlug("");
      setPubDescription("");
      setPubSystemPrompt("");
      setShowPublish(false);
      await fetchData();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Publish failed"));
    } finally {
      setPublishing(false);
    }
  };

  const handleSubmitReview = async (agentId: string) => {
    if (!token) return;
    setReviewBusy(agentId);
    setError(null);
    try {
      await submitMarketplaceAgentForReview(token, agentId);
      setSuccessMsg("Submitted for review.");
      await fetchData();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Submit failed"));
    } finally {
      setReviewBusy(null);
    }
  };

  const handleApproveAgent = async (agentId: string) => {
    if (!token) return;
    setReviewBusy(agentId);
    try {
      await reviewMarketplaceAgent(token, agentId, "published");
      setSuccessMsg("Agent published to marketplace.");
      await fetchData();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Review failed"));
    } finally {
      setReviewBusy(null);
    }
  };

  const handleInstall = async (agent: MarketplaceAgent) => {
    if (!token) {
      setError("Admin JWT required. Configure a project first.");
      return;
    }
    setDeployingId(agent.id);
    setError(null);
    setSuccessMsg(null);
    try {
      await installMarketplaceAgent(token, agent.id, { installedBy: memberUserId });
      await createAgentFromTemplate(token, agent);
      setInstalledIds((p) => new Set([...p, agent.id]));
      setSuccessMsg(`"${agent.name}" deployed in project.`);
      void fetchData();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, `Failed to deploy "${agent.name}"`));
    } finally {
      setDeployingId(null);
    }
  };

  const handleUninstall = async (agent: MarketplaceAgent) => {
    if (!token) return;
    setError(null);
    try {
      await uninstallMarketplaceAgent(token, agent.id);
      setInstalledIds((p) => { const n = new Set(p); n.delete(agent.id); return n; });
      setSuccessMsg(`"${agent.name}" uninstalled.`);
      void fetchData();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, `Failed to uninstall "${agent.name}"`));
    }
  };

  if (loading && agents.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {token && (
        <Panel className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Publish agent template</h3>
              <p className="text-xs text-muted-foreground">Create a draft, then submit for review to list in the gallery.</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowPublish((v) => !v)}>
              {showPublish ? "Hide" : "New template"}
            </Button>
          </div>
          {showPublish && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Name" value={pubName} onChange={(e) => setPubName(e.target.value)} />
              <Input placeholder="Slug" value={pubSlug} onChange={(e) => setPubSlug(e.target.value)} />
              <Input placeholder="Description" value={pubDescription} onChange={(e) => setPubDescription(e.target.value)} className="sm:col-span-2" />
              <select className="rounded-md border border-border bg-background px-2 py-1.5 text-sm" value={pubCategory} onChange={(e) => setPubCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Input placeholder="Version" value={pubVersion} onChange={(e) => setPubVersion(e.target.value)} />
              <Input placeholder="System prompt (optional)" value={pubSystemPrompt} onChange={(e) => setPubSystemPrompt(e.target.value)} className="sm:col-span-2" />
              <Button size="sm" disabled={publishing} onClick={() => void handlePublish()}>
                {publishing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                Publish draft
              </Button>
            </div>
          )}
          {myAgents.length > 0 && (
            <div className="border-t border-border pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Your templates</p>
              {myAgents.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{a.name} <Badge variant="outline" className="text-[9px] ml-1">{a.status}</Badge></span>
                  <div className="flex gap-1">
                    {a.status === "draft" && (
                      <Button size="sm" variant="outline" disabled={reviewBusy === a.id} onClick={() => void handleSubmitReview(a.id)}>
                        Submit for review
                      </Button>
                    )}
                    {a.status === "review" && (
                      <Button size="sm" variant="default" disabled={reviewBusy === a.id} onClick={() => void handleApproveAgent(a.id)}>
                        Approve &amp; publish
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="max-w-xs"
          />
        </div>
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>{stats.totalAgents} templates</span>
          <span>{stats.totalInstalls} total installs</span>
          {stats.avgRating > 0 && <span>{stats.avgRating.toFixed(1)} avg rating</span>}
        </div>
      )}

      {filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Puzzle className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {agents.length === 0
              ? "No agent templates published yet."
              : "No templates match your filters."}
          </p>
          {agents.length === 0 && token && (
            <p className="text-xs text-muted-foreground">
              Use <strong>Publish agent template</strong> above to create your first draft.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => {
            const isInstalled = installedIds.has(agent.id);
            const CatIcon = CATEGORY_ICONS[agent.category] || Bot;
            const isDeploying = deployingId === agent.id;

            return (
              <Panel key={agent.id} className="group relative flex flex-col overflow-hidden p-0">
                <button
                  onClick={() => setSelectedAgent(agent)}
                  className="flex flex-1 flex-col p-4 text-left transition-colors hover:bg-muted/20"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-gradient-to-br from-primary/10 to-primary/5">
                      <CatIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold">{agent.name}</h3>
                        {agent.featured && (
                          <Badge variant="default" className="text-[9px]">Featured</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {agent.description || "No description"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[9px]">
                      {agent.category}
                    </Badge>
                    <span>v{agent.version}</span>
                    {agent.installCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" /> {agent.installCount}
                      </span>
                    )}
                    {agent.avgRating > 0 && (
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {agent.avgRating.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {agent.tags && agent.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {agent.tags.slice(0, 3).map((t) => (
                        <Badge key={t} variant="outline" className="text-[8px]">{t}</Badge>
                      ))}
                      {agent.tags.length > 3 && (
                        <span className="text-[8px] text-muted-foreground">+{agent.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>

                <div className="flex items-center gap-1 border-t border-border px-4 py-2.5">
                  <Button
                    size="sm"
                    variant={isInstalled ? "secondary" : "default"}
                    className="flex-1 h-7 text-xs"
                    disabled={!token || isDeploying}
                    onClick={() => isInstalled ? handleUninstall(agent) : handleInstall(agent)}
                  >
                    {isDeploying ? (
                      <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Deploying...</>
                    ) : isInstalled ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> Installed</>
                    ) : (
                      <><Download className="h-3 w-3 mr-1" /> Install in 1-click</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => setSelectedAgent(agent)}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {selectedAgent && (
        <AgentTemplateDetail
          agent={selectedAgent}
          isInstalled={installedIds.has(selectedAgent.id)}
          token={token}
          memberUserId={memberUserId}
          onClose={() => setSelectedAgent(null)}
          onInstall={(a) => { void handleInstall(a); setSelectedAgent(null); }}
          onUninstall={(a) => { void handleUninstall(a); setSelectedAgent(null); }}
        />
      )}
    </div>
  );
}

/* ─── Agent Template Detail Dialog ─── */

function AgentTemplateDetail({
  agent,
  isInstalled,
  token,
  memberUserId,
  onClose,
  onInstall,
  onUninstall,
}: {
  agent: MarketplaceAgent;
  isInstalled: boolean;
  token: string;
  memberUserId: string;
  onClose: () => void;
  onInstall: (agent: MarketplaceAgent) => void;
  onUninstall: (agent: MarketplaceAgent) => void;
}) {
  const CatIcon = CATEGORY_ICONS[agent.category] || Bot;
  const [deploying, setDeploying] = useState(false);

  const handleAction = async () => {
    setDeploying(true);
    try {
      if (isInstalled) {
        await onUninstall(agent);
      } else {
        await onInstall(agent);
      }
    } finally {
      setDeploying(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-gradient-to-br from-primary/10 to-primary/5">
              <CatIcon className="h-7 w-7 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg">{agent.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {agent.description || "No description"}
              </DialogDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">{agent.category}</Badge>
                <span>v{agent.version}</span>
                {agent.installCount > 0 && (
                  <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {agent.installCount} installs</span>
                )}
                {agent.avgRating > 0 && (
                  <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {agent.avgRating.toFixed(1)}</span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-80 space-y-4 overflow-y-auto">
          {agent.longDescription && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">About</h4>
              <p className="whitespace-pre-wrap text-sm">{agent.longDescription}</p>
            </div>
          )}

          {agent.systemPrompt && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">System prompt</h4>
              <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/30 p-3 text-xs font-mono text-muted-foreground">
                {agent.systemPrompt}
              </pre>
            </div>
          )}

          {agent.tags && agent.tags.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Tags</h4>
              <div className="flex flex-wrap gap-1">
                {agent.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {agent.tools && agent.tools.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Tools</h4>
              <div className="flex flex-wrap gap-1">
                {(agent.tools as Array<{ name?: string; description?: string }>).map((t, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">{t.name || `tool_${i}`}</Badge>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-md bg-muted/20 p-2">
              <span className="text-muted-foreground">Model</span>
              <p className="font-medium">{(agent.configTemplate.model as string) || "gpt-4o-mini"}</p>
            </div>
            <div className="rounded-md bg-muted/20 p-2">
              <span className="text-muted-foreground">Provider</span>
              <p className="font-medium">{(agent.configTemplate.provider as string) || "openai"}</p>
            </div>
            <div className="rounded-md bg-muted/20 p-2">
              <span className="text-muted-foreground">Pricing</span>
              <p className="font-medium capitalize">{agent.pricing}</p>
            </div>
            <div className="rounded-md bg-muted/20 p-2">
              <span className="text-muted-foreground">Published</span>
              <p className="font-medium">{new Date(agent.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            {isInstalled
              ? "Installed in current project. Uninstall to remove."
              : "Deploy this agent template to your project with 1 click."}
          </p>
          <Button
            size="sm"
            variant={isInstalled ? "secondary" : "default"}
            disabled={!token || deploying}
            onClick={handleAction}
          >
            {deploying ? (
              <><Loader2 className="h-3 w-3 animate-spin mr-1" /> {isInstalled ? "Removing..." : "Deploying..."}</>
            ) : isInstalled ? (
              <><Trash2 className="h-3 w-3 mr-1" /> Uninstall</>
            ) : (
              <><Download className="h-3 w-3 mr-1" /> Deploy to project</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Providers (SDK demo) ─── */

function ProviderMarketplaceTab() {
  const [store] = useState(() => createProviderMarketplace());
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [keys, setKeys] = useState<ProviderKey[]>([]);
  const [keyInput, setKeyInput] = useState("");
  const [keyLabel, setKeyLabel] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("openai");

  useState(() => {
    BUILTIN_PROVIDERS.forEach((p) => store.registerProvider(p));
    setProviders(BUILTIN_PROVIDERS);
  });

  const registeredIds = new Set(providers.map((p) => p.id));
  const selectedP = providers.find((p) => p.id === selectedProvider);

  return (
    <div className="space-y-6">
      <Panel className="p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Star className="h-4 w-4" /> Add your own API key
        </h3>
        <p className="text-xs text-muted-foreground mt-1">Keys stored in-memory. This is a client-side demo.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)}>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Input placeholder="sk-..." className="max-w-[200px] font-mono text-xs" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} />
          <Input placeholder="Label (optional)" className="max-w-[120px]" value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} />
          <Button size="sm" onClick={() => {
            if (!keyInput.trim()) return;
            const key = store.addKey(selectedProvider, keyInput.trim(), keyLabel.trim() || undefined);
            setKeys((p) => [...p, key]);
            setKeyInput(""); setKeyLabel("");
          }}><Key className="h-3 w-3 mr-1" /> Save key</Button>
        </div>
      </Panel>

      {selectedP && (
        <Panel className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`h-4 w-4 rounded-full ${selectedP.id === "openai" ? "bg-emerald-500" : selectedP.id === "anthropic" ? "bg-amber-500" : "bg-blue-500"}`} />
            <h3 className="text-sm font-semibold">{selectedP.name}</h3>
            <Badge variant="outline" className="text-[9px]">{selectedP.supportsStreaming ? "streaming" : ""}</Badge>
          </div>
          <div className="space-y-2">
            {selectedP.models.map((m: LlmModel) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium font-mono">{m.id}</span>
                    <span className="text-xs text-muted-foreground">{m.name}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {m.capabilities.map((cap: string) => (
                      <Badge key={cap} variant="outline" className="text-[9px]">{cap}</Badge>
                    ))}
                    <span className="text-[10px] text-muted-foreground">max {m.maxTokens.toLocaleString()} tokens</span>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-xs font-medium">${m.costPer1kInput}/1k in</p>
                  <p className="text-xs text-muted-foreground">${m.costPer1kOutput}/1k out</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {keys.length > 0 && (
        <Panel className="p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Key className="h-4 w-4" /> Saved keys ({keys.length})</h3>
          <div className="mt-2 space-y-1.5">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-md border border-border bg-muted/20 p-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-mono truncate">{k.key.slice(0, 12)}...</p>
                  <p className="text-[10px] text-muted-foreground">{k.providerId}{k.label ? ` · ${k.label}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={k.isActive ? "default" : "outline"} className="text-[9px]">{k.isActive ? "active" : "inactive"}</Badge>
                  <button onClick={() => { store.removeKey(k.id); setKeys((p) => p.filter((x) => x.id !== k.id)); }}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">All registered providers</summary>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {providers.map((p) => (
            <button key={p.id} onClick={() => setSelectedProvider(p.id)}
              className={`rounded-md border p-2 text-left transition-colors ${p.id === selectedProvider ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20 hover:bg-muted/30"}`}>
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-[10px] text-muted-foreground">{p.models.length} models</p>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

/* ─── MCP Apps marketplace (curated + 1-click install) ─── */

function McpAppsMarketplaceTab() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [apps, setApps] = useState<McpAppCatalogEntry[]>([]);
  const [installed, setInstalled] = useState<McpAppInstall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [agentId, setAgentId] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const catalog = await listMcpAppsCatalog();
      setApps(catalog.apps ?? []);
      if (token) {
        const inst = await listInstalledMcpApps(token);
        setInstalled(inst.installed ?? []);
      }
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to load MCP apps"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const installedIds = useMemo(() => new Set(installed.map((i) => i.appId)), [installed]);

  async function handleInstall(appId: string) {
    if (!token) {
      setError("Admin JWT required.");
      return;
    }
    setBusy(appId);
    setNotice(null);
    try {
      await installMcpApp(token, appId, agentId.trim() || undefined);
      setNotice("MCP app installed. Tools registered in MCP identity.");
      await loadAll();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Install failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleUninstall(appId: string) {
    if (!token) return;
    setBusy(`un-${appId}`);
    try {
      await uninstallMcpApp(token, appId, agentId.trim() || undefined);
      setNotice("MCP app uninstalled.");
      await loadAll();
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Uninstall failed"));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <Panel className="p-4 space-y-2 max-w-md">
        <p className="text-xs text-muted-foreground">Optional agent ID to scope the install (leave empty for project-wide).</p>
        <Input placeholder="Agent ID (optional)" value={agentId} onChange={(e) => setAgentId(e.target.value)} />
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => {
          const isInstalled = installedIds.has(app.id);
          const isBusy = busy === app.id || busy === `un-${app.id}`;
          return (
            <Panel key={app.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{app.name}</h3>
                  <p className="text-xs text-muted-foreground">{app.vendor}</p>
                </div>
                {app.verified && <Badge variant="default" className="text-[9px]">Verified</Badge>}
                {app.auditGrade && (
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-mono ${app.auditGrade === "A" || app.auditGrade === "B" ? "border-emerald-300 text-emerald-700" : app.auditSeverityCritical ? "border-red-300 text-red-700" : ""}`}
                    title={
                      [
                        app.auditScore != null ? `Score ${app.auditScore}` : null,
                        app.auditScannedAt ? `Scanned ${new Date(app.auditScannedAt).toLocaleDateString()}` : null,
                        app.auditSeverityCritical ? `${app.auditSeverityCritical} critical findings` : null,
                      ].filter(Boolean).join(" · ") || undefined
                    }
                  >
                    Audit {app.auditGrade}
                  </Badge>
                )}
              </div>
              <p className="mt-2 flex-1 text-xs text-muted-foreground line-clamp-3">{app.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {app.tools.slice(0, 3).map((t) => (
                  <Badge key={t} variant="outline" className="text-[8px]">{t}</Badge>
                ))}
              </div>
              <Button
                size="sm"
                className="mt-3 w-full"
                variant={isInstalled ? "secondary" : "default"}
                disabled={!token || isBusy}
                onClick={() => void (isInstalled ? handleUninstall(app.id) : handleInstall(app.id))}
              >
                {isBusy ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                {isInstalled ? "Uninstall" : "Install 1-click"}
              </Button>
            </Panel>
          );
        })}
      </div>

      {apps.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">No curated MCP apps in catalog yet.</p>
      )}
    </div>
  );
}
