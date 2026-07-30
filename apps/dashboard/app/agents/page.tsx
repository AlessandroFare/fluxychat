"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Download, Loader2, Puzzle, Sparkles } from "lucide-react";
import { Panel } from "@/app/components/ui";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import {
  createAgentFromTemplate,
  listMarketplaceAgents,
  type MarketplaceAgent,
} from "@/lib/marketplace-client";
import { messageFromUnknown } from "@/lib/error-message";

const STARTER_TEMPLATES: MarketplaceAgent[] = [
  {
    id: "starter-support",
    publisherId: "fluxy",
    name: "Support assistant",
    slug: "support-assistant",
    description: "Answers FAQs and escalates to humans when confidence is low.",
    longDescription: null,
    category: "support",
    iconUrl: null,
    configTemplate: { provider: "openai", model: "gpt-4o-mini" },
    systemPrompt: "You are a helpful support agent. Be concise and escalate when unsure.",
    tools: null,
    integrations: null,
    pricing: "free",
    pricingConfig: null,
    version: "1.0.0",
    status: "published",
    installCount: 0,
    avgRating: 0,
    reviewCount: 0,
    featured: true,
    tags: ["support", "hitl"],
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "starter-sales",
    publisherId: "fluxy",
    name: "Sales copilot",
    slug: "sales-copilot",
    description: "Qualifies leads and summarizes conversations for CRM handoff.",
    longDescription: null,
    category: "sales",
    iconUrl: null,
    configTemplate: { provider: "openai", model: "gpt-4o-mini" },
    systemPrompt: "You qualify inbound leads and capture contact details professionally.",
    tools: null,
    integrations: null,
    pricing: "free",
    pricingConfig: null,
    version: "1.0.0",
    status: "published",
    installCount: 0,
    avgRating: 0,
    reviewCount: 0,
    featured: false,
    tags: ["sales"],
    createdAt: "",
    updatedAt: "",
  },
];

export default function AgentsIndexPage() {
  const router = useRouter();
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = adminJwt.trim() || memberJwt.trim();
  const [templates, setTemplates] = useState<MarketplaceAgent[]>(STARTER_TEMPLATES);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const remote = await listMarketplaceAgents({ sort: "featured", limit: 12 });
      if (remote.length > 0) setTemplates(remote);
    } catch {
      // Keep built-in starters when marketplace is empty or unreachable.
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  async function installTemplate(template: MarketplaceAgent) {
    if (!token) {
      setError("Connect a project session first (Onboarding or Projects).");
      return;
    }
    setDeployingId(template.id);
    setError(null);
    try {
      const res = await createAgentFromTemplate(token, template);
      setNotice(`Installed "${template.name}".`);
      if (res.agent?.id) {
        router.push(`/agents/${res.agent.id}`);
      }
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Install failed"));
    } finally {
      setDeployingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <Panel className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-8 text-center">
        <Bot className="mb-3 h-10 w-10 text-muted-foreground/50" />
        <h2 className="font-heading text-lg font-medium">Select or install an agent</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Pick an agent from the sidebar, create one with <strong>New agent</strong>, or install a template below in one click.
        </p>
      </Panel>

      {(error || notice) && (
        <p className={`text-sm ${error ? "text-red-600" : "text-emerald-600"}`}>{error || notice}</p>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-primary" />
            <h3 className="font-heading text-base font-semibold">Agent templates</h3>
          </div>
          <Link href="/marketplace" className="text-xs text-muted-foreground underline underline-offset-2">
            Full marketplace
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((template) => {
            const busy = deployingId === template.id;
            return (
              <Panel key={template.id} className="flex flex-col p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-gradient-to-br from-primary/10 to-primary/5">
                    {template.featured ? (
                      <Sparkles className="h-5 w-5 text-primary" />
                    ) : (
                      <Bot className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium">{template.name}</h4>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {template.description || "No description"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[9px]">
                        {template.category}
                      </Badge>
                      {template.tags?.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[9px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="mt-4 w-full"
                  disabled={!token || busy}
                  onClick={() => void installTemplate(template)}
                >
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Install 1-click
                </Button>
              </Panel>
            );
          })}
        </div>
      </section>
    </div>
  );
}
