"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { OpsMcpServersCard } from "../../components/ops-mcp-servers-card";
import { OpsMcpConnectionsCard } from "../../components/ops-mcp-connections-card";
import { Banner, Button, Input, Section, Textarea } from "../../components/ui";
import { useDashboardSession } from "../../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import { opsGetPolicy, opsGetSources, opsListTools, opsPatchTool, opsPutPolicy } from "@/lib/ops-client";

export default function OpsSettingsPage() {
  const { memberJwt, adminJwt } = useDashboardSession();
  const token = memberJwt.trim() || adminJwt.trim();
  const [tools, setTools] = useState<Array<{ name: string; description: string; side: string; risk: string; enabled: boolean }>>(
    [],
  );
  const [domains, setDomains] = useState("");
  const [quorum, setQuorum] = useState("2");
  const [views, setViews] = useState<string[]>([]);
  const [namedViews, setNamedViews] = useState<Array<{ name: string; description?: string; columns?: string[] }>>([]);
  const [sources, setSources] = useState<{ aiSearch: boolean; vectorize: boolean; r2: boolean; workersAi: boolean } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [incidentCreated, setIncidentCreated] = useState("");
  const [incidentAcknowledged, setIncidentAcknowledged] = useState("");
  const [incidentResolved, setIncidentResolved] = useState("");

  // Reloads run through the effect (cancellation-safe); handlers just bump the key.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function load() {
      try {
        const [t, p, s] = await Promise.all([opsListTools(token), opsGetPolicy(token), opsGetSources(token)]);
        if (cancelled) return;
        setTools(t.tools || []);
        setDomains((p.policy.guestDomains || []).join(", "));
        setQuorum(String(p.policy.highRiskQuorum ?? 2));
        setViews(p.policy.allowedViews || []);
        setNamedViews(p.namedViews || []);
        setIncidentCreated(p.policy.incidentWorkflowSlugs?.created || p.policy.incidentWorkflowSlug || "");
        setIncidentAcknowledged(p.policy.incidentWorkflowSlugs?.acknowledged || "");
        setIncidentResolved(p.policy.incidentWorkflowSlugs?.resolved || "");
        setSources(s);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(messageFromUnknown(err, "Could not load tools"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  const reload = () => setReloadKey((key) => key + 1);

  return (
    <ConsoleShell>
      <ConsolePageHeader
        icon={ClipboardCheck}
        title="Process tools"
        description="Only enabled tools can appear in a draft. The assistant cannot invent a connector. Guests must match an allowed email domain."
        actions={
          <Link
            href="/ops"
            className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2.5 text-xs font-semibold hover:bg-muted/60"
          >
            Builder
          </Link>
        }
      />
      {!token ? <Banner variant="warn">Sign in with a project token to change policy.</Banner> : null}
      {error ? <Banner variant="error">{error}</Banner> : null}
      {notice ? <Banner variant="info">{notice}</Banner> : null}
      {loading && token ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading
        </p>
      ) : null}

      {sources ? (
        <Banner variant={sources.aiSearch || sources.r2 ? "info" : "warn"}>
          Search: {sources.aiSearch ? "AI Search bound" : "D1/Vectorize fallback"}. Files:{" "}
          {sources.r2 ? "R2" : "metadata only"}. OCR: {sources.workersAi ? "Workers AI" : "stored text only"}.
        </Banner>
      ) : null}

      <Section title="Enabled tools" description="Turn off anything this workspace must not call. Writes still need a hashed human approval.">
        <ul className="space-y-2">
          {tools.map((tool) => (
            <li key={tool.name} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{tool.name}</p>
                <p className="text-muted-foreground">
                  {tool.description} · {tool.side} · {tool.risk}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={tool.enabled ? "outline" : "secondary"}
                disabled={!token || busy === tool.name}
                onClick={async () => {
                  setBusy(tool.name);
                  try {
                    await opsPatchTool(token, tool.name, !tool.enabled);
                    reload();
                  } catch (err) {
                    setError(messageFromUnknown(err, "Could not update tool"));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {tool.enabled ? "Enabled" : "Off"}
              </Button>
            </li>
          ))}
        </ul>
      </Section>

      <OpsMcpServersCard token={token} />

      <OpsMcpConnectionsCard token={token} />

      <Section title="Guest domains and quorum">
        <label className="mb-3 block text-sm">
          Allowed guest email domains (comma separated)
          <Textarea rows={2} className="mt-1" value={domains} onChange={(e) => setDomains(e.target.value)} />
        </label>
        <label className="mb-3 block text-sm">
          High-risk approval count
          <input
            className="mt-1 h-8 w-24 rounded-md border border-border bg-background px-2 text-sm"
            value={quorum}
            onChange={(e) => setQuorum(e.target.value)}
          />
        </label>
        {namedViews.length ? (
          <ul className="mb-3 space-y-1 text-sm text-muted-foreground">
            {namedViews.map((view) => (
              <li key={view.name}>
                <span className="font-medium text-foreground">{view.name}</span>
                {view.columns?.length ? ` — columns: ${view.columns.join(", ")}` : ""}
                {view.description ? ` (${view.description})` : ""}
              </li>
            ))}
          </ul>
        ) : views.length ? (
          <p className="mb-3 text-sm text-muted-foreground">
            Named views the engine may query (not free SQL): {views.join(", ")}
          </p>
        ) : null}
        <Button
          type="button"
          disabled={!token || busy === "policy"}
          onClick={async () => {
            setBusy("policy");
            setNotice(null);
            try {
              await opsPutPolicy(token, {
                guestDomains: domains
                  .split(",")
                  .map((d) => d.trim())
                  .filter(Boolean),
                highRiskQuorum: Number(quorum) || 2,
              });
              setNotice("Policy saved. New drafts use this catalog.");
            } catch (err) {
              setError(messageFromUnknown(err, "Could not save policy"));
            } finally {
              setBusy(null);
            }
          }}
        >
          Save policy
        </Button>
      </Section>

      <Section
        title="Incident workflows"
        description="Published workflow slug the engine starts for each incident phase, in the room linked to the incident. Empty = incidents are tracked without a run."
      >
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <label className="text-sm">
            On create
            <Input
              className="mt-1"
              placeholder="incident-response"
              value={incidentCreated}
              onChange={(e) => setIncidentCreated(e.target.value)}
            />
          </label>
          <label className="text-sm">
            On acknowledge
            <Input
              className="mt-1"
              placeholder="none"
              value={incidentAcknowledged}
              onChange={(e) => setIncidentAcknowledged(e.target.value)}
            />
          </label>
          <label className="text-sm">
            On resolve
            <Input
              className="mt-1"
              placeholder="postmortem"
              value={incidentResolved}
              onChange={(e) => setIncidentResolved(e.target.value)}
            />
          </label>
        </div>
        <Button
          type="button"
          disabled={!token || busy === "incident-workflows"}
          onClick={async () => {
            setBusy("incident-workflows");
            setNotice(null);
            try {
              // Saving moves the legacy single slug into the phase map.
              await opsPutPolicy(token, {
                incidentWorkflowSlug: null,
                incidentWorkflowSlugs: {
                  created: incidentCreated.trim() || null,
                  acknowledged: incidentAcknowledged.trim() || null,
                  resolved: incidentResolved.trim() || null,
                },
              });
              reload();
              setNotice("Incident workflows saved.");
            } catch (err) {
              setError(messageFromUnknown(err, "Could not save incident workflows"));
            } finally {
              setBusy(null);
            }
          }}
        >
          Save incident workflows
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Events come from PagerDuty, incident.io and Sentry webhooks. Runs are approval-gated like any other process and
          show up in the incident room timeline.
        </p>
      </Section>
    </ConsoleShell>
  );
}
