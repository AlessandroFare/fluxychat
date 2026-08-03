"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, Plus, Radio, Trash2, Zap } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createAmbientPolicy,
  deleteAmbientPolicy,
  dispatchAmbientEvent,
  listAmbientPolicies,
  listAmbientPolicyRuns,
  triggerAmbientPolicy,
  type AmbientAutonomy,
  type AmbientPolicy,
  type AmbientPolicyRun,
  type AmbientTriggerType,
} from "@/lib/ambient-agents-client";

export default function AmbientAgentsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [policies, setPolicies] = useState<AmbientPolicy[]>([]);
  const [runs, setRuns] = useState<AmbientPolicyRun[]>([]);

  const [name, setName] = useState("Keyword help responder");
  const [triggerType, setTriggerType] = useState<AmbientTriggerType>("message_keyword");
  const [triggerPattern, setTriggerPattern] = useState("help");
  const [agentId, setAgentId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [maxAutonomy, setMaxAutonomy] = useState<AmbientAutonomy>("notify");
  const [promptTemplate, setPromptTemplate] = useState(
    "A user message matched keyword policy. Room {{roomId}}. Content: {{content}}. Reply with one helpful sentence.",
  );

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [p, r] = await Promise.all([listAmbientPolicies(token), listAmbientPolicyRuns(token)]);
      setPolicies(p.policies ?? []);
      setRuns(r.runs ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load ambient policies"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    if (!token || !name.trim() || !triggerPattern.trim() || !agentId.trim()) return;
    setBusy("create");
    try {
      await createAmbientPolicy(token, {
        name: name.trim(),
        triggerType,
        triggerPattern: triggerPattern.trim(),
        agentId: agentId.trim(),
        roomId: roomId.trim() || undefined,
        maxAutonomy,
        promptTemplate: promptTemplate.trim() || undefined,
        cooldownSeconds: 60,
      });
      setNotice("Ambient policy created.");
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Create failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    setBusy(`del-${id}`);
    try {
      await deleteAmbientPolicy(token, id);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Delete failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleTestPolicy(policy: AmbientPolicy) {
    if (!token) return;
    setBusy(`test-${policy.id}`);
    try {
      const result = await triggerAmbientPolicy(token, policy.id, {
        roomId: roomId.trim() || policy.roomId || undefined,
        triggerKey: policy.triggerPattern,
        payload: { content: "Test ambient trigger from console", source: "dashboard" },
      });
      setNotice(`Policy run: ${result.status ?? (result.ok ? "ok" : "failed")}`);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Test trigger failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDispatchWebhook() {
    if (!token || !triggerPattern.trim()) return;
    setBusy("dispatch");
    try {
      const result = await dispatchAmbientEvent(token, {
        triggerType: "webhook",
        triggerKey: triggerPattern.trim(),
        roomId: roomId.trim() || undefined,
        payload: { event: triggerPattern.trim(), source: "manual-dispatch" },
      });
      setNotice(`Webhook dispatch matched ${result.matched ?? 0} policy/policies.`);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Dispatch failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell className="max-w-4xl">
      <ConsolePageHeader
        title="Ambient agents"
        description="Event-driven agent policies — react to keywords, webhooks, and room events without @mention."
      />

      <p className="mb-4 text-sm text-muted-foreground">
        Autonomy: <Badge variant="outline">observe</Badge> audit only ·{" "}
        <Badge variant="secondary">notify</Badge> AI post · <Badge variant="default">act</Badge> full agent run.{" "}
        <Link href="/agents" className="underline underline-offset-2">
          Agents
        </Link>
      </p>

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">Admin JWT required.</Panel>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="space-y-8">
          <Section title="Create policy">
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Policy name" />
              <Input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="Agent id (bot id)" />
              <Input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Room id (optional)" />
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as AmbientTriggerType)}
              >
                <option value="message_keyword">message_keyword</option>
                <option value="webhook">webhook</option>
                <option value="room_event">room_event</option>
              </select>
              <Input
                value={triggerPattern}
                onChange={(e) => setTriggerPattern(e.target.value)}
                placeholder="Trigger pattern (keyword or event name)"
              />
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={maxAutonomy}
                onChange={(e) => setMaxAutonomy(e.target.value as AmbientAutonomy)}
              >
                <option value="observe">observe</option>
                <option value="notify">notify</option>
                <option value="act">act</option>
              </select>
            </div>
            <textarea
              className="mt-3 min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-mono"
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              placeholder="Prompt template with {{content}}, {{roomId}}, {{triggerKey}}"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled={busy === "create"} onClick={() => void handleCreate()}>
                <Plus className="mr-2 h-4 w-4" /> Create policy
              </Button>
              <Button variant="outline" disabled={busy === "dispatch"} onClick={() => void handleDispatchWebhook()}>
                <Zap className="mr-2 h-4 w-4" /> Test webhook dispatch
              </Button>
            </div>
          </Section>

          <Section title={`Policies (${policies.length})`}>
            {policies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No policies yet.</p>
            ) : (
              <ul className="space-y-2">
                {policies.map((policy) => (
                  <li key={policy.id} className="rounded-lg border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Radio className="h-4 w-4 text-brand" />
                      <span className="font-medium">{policy.name}</span>
                      <Badge variant="outline">{policy.triggerType}</Badge>
                      <Badge variant="secondary">{policy.maxAutonomy}</Badge>
                      {!policy.enabled ? <Badge variant="destructive">disabled</Badge> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      pattern <code>{policy.triggerPattern}</code> · agent {policy.agentId}
                      {policy.roomId ? ` · room ${policy.roomId}` : ""}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void handleTestPolicy(policy)}>
                        <Play className="mr-1 h-3 w-3" /> Test
                      </Button>
                      <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void handleDelete(policy.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {runs.length > 0 ? (
            <Section title="Recent runs">
              <ul className="space-y-2 text-xs">
                {runs.slice(0, 10).map((run) => (
                  <li key={run.id} className="rounded border px-2 py-1.5">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{run.status}</Badge>
                      <span className="text-muted-foreground">{formatDateTime(run.createdAt)}</span>
                      <span className="font-mono">{run.policyId.slice(0, 12)}…</span>
                    </div>
                    {run.error ? <p className="text-red-600">{run.error}</p> : null}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      )}
    </ConsoleShell>
  );
}
