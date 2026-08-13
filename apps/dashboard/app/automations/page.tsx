"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Play, Plus, Zap } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleFeedback } from "../components/console-feedback";
import { Button, Input, Panel, Section } from "../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import { createWorkflow, listWorkflows, runWorkflow, type WorkflowDefinition } from "@/lib/automations-client";

export default function AutomationsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("Message contains help → notify agent");
  const [triggerKeyword, setTriggerKeyword] = useState("help");
  const [agentId, setAgentId] = useState("support-bot");
  const [roomId, setRoomId] = useState("");

  const loadWorkflows = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listWorkflows(token);
      setWorkflows(rows);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load workflows"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  async function handleCreate() {
    if (!token || !name.trim()) return;
    setBusy("create");
    try {
      await createWorkflow(token, {
        name: name.trim(),
        description: `When message contains "${triggerKeyword}"`,
        triggerType: "message.created",
        triggerConfig: { contains: triggerKeyword.trim(), roomId: roomId.trim() || undefined },
        conditions: { textContains: triggerKeyword.trim() },
        actions: [
          { type: "invoke_agent", agentId: agentId.trim() || "support-bot" },
          { type: "notify", channel: "agent-queue", message: `Auto-triggered for keyword "${triggerKeyword}"` },
        ],
      });
      setNotice("Workflow created (draft). Run manually or activate via PATCH.");
      await loadWorkflows();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to create workflow"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRun(id: string) {
    if (!token) return;
    setBusy(`run-${id}`);
    try {
      const result = await runWorkflow(token, id, { roomId: roomId.trim() || undefined, keyword: triggerKeyword });
      setNotice(`Execution started: ${result.id}`);
    } catch (err) {
      setError(messageFromUnknown(err, "Run failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Automations"
        description="IF-THEN workflows: when a message matches a trigger, invoke an agent or send a notification."
      />

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">
          Admin JWT required. <Link href="/projects" className="font-medium underline-offset-2 hover:underline">Projects</Link>.
        </Panel>
      ) : (
        <div className="space-y-8">
          <Section title="Create rule">
            <p className="mb-3 text-sm text-muted-foreground">
              Example: when message contains <strong>help</strong> → invoke agent → notify agent queue.
            </p>
            <Input className="mb-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" />
            <div className="grid gap-2 md:grid-cols-3">
              <Input value={triggerKeyword} onChange={(e) => setTriggerKeyword(e.target.value)} placeholder="Trigger keyword" />
              <Input value={agentId} onChange={(e) => setAgentId(e.target.value)} placeholder="Agent id" />
              <Input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Room id (optional)" />
            </div>
            <Button className="mt-3" size="sm" disabled={busy === "create"} onClick={() => void handleCreate()}>
              {busy === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create workflow
            </Button>
          </Section>

          <Section title="Workflows">
            {loading ? (
              <p className="text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /> Loading…</p>
            ) : workflows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workflows yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border bg-white/90">
                {workflows.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{w.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="mr-2">{w.status}</Badge>
                        {w.triggerType} · runs {w.runCount ?? 0}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" disabled={busy === `run-${w.id}`} onClick={() => void handleRun(w.id)}>
                      {busy === `run-${w.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
                      Run
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <p className="text-xs text-muted-foreground">
            <Zap className="mr-1 inline h-3 w-3" />
            Local rule builder also at <Link href="/chatbot-builder" className="font-medium underline-offset-2 hover:underline">Chatbot Builder</Link>.
            Worker API: <code className="text-[11px]">/api/workflows</code>.
          </p>
        </div>
      )}
    </ConsoleShell>
  );
}
