"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Bot, Download, Star, Loader2, CheckCircle2, AlertCircle,
  Trash2, MessageSquare, BookOpen, Shield, Layers, Zap, Code, Sparkles,
} from "lucide-react";
import { ConsoleShell } from "../../../components/console-shell";
import { ConsolePageHeader } from "../../../components/console-page-header";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../../components/dashboard-session";
import { useClerkUser } from "@/lib/clerk-user";
import { fluxyUserIdFromClerk } from "@/lib/fluxy-clerk-user";
import { messageFromUnknown } from "@/lib/error-message";
import {
  getMarketplaceAgent,
  installMarketplaceAgent,
  uninstallMarketplaceAgent,
  listInstalledMarketplaceAgents,
  createAgentFromTemplate,
  type MarketplaceAgent,
} from "@/lib/marketplace-client";

const CATEGORY_ICONS: Record<string, typeof Bot> = {
  general: Bot, support: MessageSquare, onboarding: BookOpen, moderation: Shield,
  analytics: Layers, sales: Zap, developer: Code, productivity: Sparkles,
};

export default function TemplateDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolved = use(params);
  const router = useRouter();
  const { adminJwt, activeProject } = useDashboardSession();
  const { user: clerkUser } = useClerkUser();
  const memberUserId = clerkUser?.id ? fluxyUserIdFromClerk(clerkUser.id) : "dashboard";
  const token = adminJwt.trim();

  const [agent, setAgent] = useState<MarketplaceAgent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const a = await getMarketplaceAgent(resolved.slug);
        if (cancelled) return;
        if (!a) { setError("Template not found."); setLoading(false); return; }
        setAgent(a);
        if (token) {
          const installed = await listInstalledMarketplaceAgents(token);
          if (!cancelled) setIsInstalled(installed.some((i) => i.agentId === a.id));
        }
      } catch (err: unknown) {
        if (!cancelled) setError(messageFromUnknown(err, "Failed to load template"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [resolved.slug, token]);

  const handleDeploy = async () => {
    if (!agent || !token) return;
    setDeploying(true);
    setError(null);
    setSuccess(null);
    try {
      await installMarketplaceAgent(token, agent.id, { installedBy: memberUserId });
      await createAgentFromTemplate(token, agent);
      setIsInstalled(true);
      setSuccess(`"${agent.name}" deployed successfully.`);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Deploy failed"));
    } finally {
      setDeploying(false);
    }
  };

  const handleUninstall = async () => {
    if (!agent || !token) return;
    setDeploying(true);
    setError(null);
    setSuccess(null);
    try {
      await uninstallMarketplaceAgent(token, agent.id);
      setIsInstalled(false);
      setSuccess(`"${agent.name}" uninstalled.`);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Uninstall failed"));
    } finally {
      setDeploying(false);
    }
  };

  if (loading) {
    return (
      <ConsoleShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </ConsoleShell>
    );
  }

  if (error && !agent) {
    return (
      <ConsoleShell>
        <div className="flex flex-col items-center gap-4 py-20">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" onClick={() => router.back()}>Go back</Button>
        </div>
      </ConsoleShell>
    );
  }

  if (!agent) return null;

  const CatIcon = CATEGORY_ICONS[agent.category] || Bot;

  return (
    <ConsoleShell>
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to marketplace
      </button>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> <span>{success}</span>
        </div>
      )}

      <Panel className="overflow-hidden p-0">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-primary/5">
            <CatIcon className="h-10 w-10 text-primary" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{agent.description || "No description"}</p>
              </div>
              <Button
                size="sm"
                variant={isInstalled ? "secondary" : "default"}
                disabled={!token || deploying}
                onClick={isInstalled ? handleUninstall : handleDeploy}
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

            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">{agent.category}</Badge>
              <span>v{agent.version}</span>
              <span className="flex items-center gap-1"><Download className="h-3 w-3" /> {agent.installCount} installs</span>
              {agent.avgRating > 0 && (
                <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {agent.avgRating.toFixed(1)}</span>
              )}
              <span className="capitalize">{agent.pricing}</span>
              <span>Published {new Date(agent.createdAt).toLocaleDateString()}</span>
            </div>

            {agent.tags && agent.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {agent.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
              </div>
            )}
          </div>
        </div>

        {agent.longDescription && (
          <div className="border-t border-border px-6 py-4">
            <h2 className="mb-2 text-sm font-semibold">About</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{agent.longDescription}</p>
          </div>
        )}

        <div className="grid gap-4 border-t border-border px-6 py-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold">Configuration</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between rounded bg-muted/20 px-3 py-2">
                <span className="text-muted-foreground">Model</span>
                <span className="font-medium">{(agent.configTemplate.model as string) || "gpt-4o-mini"}</span>
              </div>
              <div className="flex justify-between rounded bg-muted/20 px-3 py-2">
                <span className="text-muted-foreground">Provider</span>
                <span className="font-medium">{(agent.configTemplate.provider as string) || "openai"}</span>
              </div>
              <div className="flex justify-between rounded bg-muted/20 px-3 py-2">
                <span className="text-muted-foreground">Pricing</span>
                <span className="font-medium capitalize">{agent.pricing}</span>
              </div>
              <div className="flex justify-between rounded bg-muted/20 px-3 py-2">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">{agent.version}</span>
              </div>
            </div>
          </div>

          {agent.tools && agent.tools.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold">Tools</h2>
              <div className="space-y-1.5">
                {(agent.tools as Array<{ name?: string; description?: string }>).map((t, i) => (
                  <div key={i} className="rounded-md bg-muted/20 p-2.5">
                    <p className="text-xs font-medium">{t.name || `Tool ${i + 1}`}</p>
                    {t.description && <p className="text-[10px] text-muted-foreground">{t.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {agent.systemPrompt && (
          <div className="border-t border-border px-6 py-4">
            <h2 className="mb-2 text-sm font-semibold">System prompt</h2>
            <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/30 p-3 text-xs font-mono text-muted-foreground">
              {agent.systemPrompt}
            </pre>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <p className="text-xs text-muted-foreground">
            {isInstalled
              ? "This template is installed in your current project."
              : "Deploy this template to create an agent in your project."}
          </p>
          <Button
            size="sm"
            variant={isInstalled ? "secondary" : "default"}
            disabled={!token || deploying}
            onClick={isInstalled ? handleUninstall : handleDeploy}
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
      </Panel>
    </ConsoleShell>
  );
}
