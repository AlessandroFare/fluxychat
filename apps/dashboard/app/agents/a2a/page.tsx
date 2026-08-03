"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Network, Plus, Send } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  checkA2AAgentHealth,
  createA2ATask,
  listA2AAgentCards,
  listA2ATasks,
  receiveA2AEnvelopes,
  registerA2AAgentCard,
  sendA2AEnvelope,
  type A2AAgentCard,
  type A2ATask,
} from "@/lib/a2a-client";

export default function A2AAgentsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [cards, setCards] = useState<A2AAgentCard[]>([]);
  const [tasks, setTasks] = useState<A2ATask[]>([]);
  const [log, setLog] = useState<string[]>([]);

  const [agentId, setAgentId] = useState("agent-alpha");
  const [agentName, setAgentName] = useState("Alpha Agent");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [targetAgentId, setTargetAgentId] = useState("agent-beta");
  const [taskTitle, setTaskTitle] = useState("Translate greeting");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [c, t] = await Promise.all([listA2AAgentCards(token), listA2ATasks(token)]);
      setCards(c.cards ?? []);
      setTasks(t.tasks ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load A2A data"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRegister() {
    if (!token || !agentId.trim() || !agentName.trim()) return;
    setBusy("register");
    try {
      await registerA2AAgentCard(token, {
        agentId: agentId.trim(),
        name: agentName.trim(),
        endpointUrl: endpointUrl.trim() || undefined,
        capabilities: ["translate", "summarize"],
      });
      setNotice("Agent card registered.");
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Register failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleHealth(card: A2AAgentCard) {
    if (!token) return;
    setBusy(`health-${card.agentId}`);
    try {
      const res = await checkA2AAgentHealth(token, card.agentId);
      setLog((prev) => [
        `${card.agentId} health: ${res.health.ok ? "ok" : res.health.error ?? "fail"}`,
        ...prev.slice(0, 9),
      ]);
    } catch (err) {
      setError(messageFromUnknown(err, "Health check failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateTask() {
    if (!token || !taskTitle.trim()) return;
    setBusy("task");
    try {
      const res = await createA2ATask(token, {
        title: taskTitle.trim(),
        input: { text: "hello" },
        targetAgentId: targetAgentId.trim() || undefined,
      });
      setNotice(`Task ${res.task.id} created.`);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Create task failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleSendEnvelope(taskId: string) {
    if (!token) return;
    setBusy("env");
    try {
      await sendA2AEnvelope(token, {
        sourceAgentId: agentId.trim() || "agent-alpha",
        targetAgentId: targetAgentId.trim() || "agent-beta",
        taskId,
        status: "pending",
      });
      const received = await receiveA2AEnvelopes(token, targetAgentId.trim() || "agent-beta");
      setLog((prev) => [
        `Envelope delivered → ${received.envelopes?.length ?? 0} received`,
        ...prev.slice(0, 9),
      ]);
    } catch (err) {
      setError(messageFromUnknown(err, "Envelope failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="A2A protocol"
        description="Agent Card registry, task delegation, and envelope delivery — Worker-backed spike (#24)."
      />

      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/agents" className="font-medium underline-offset-4 hover:underline">
          ← Agents
        </Link>
        {" · "}
        <Link href="/cross-channel" className="font-medium underline-offset-4 hover:underline">
          SDK demo
        </Link>
      </p>

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">Admin JWT required.</Panel>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="space-y-8">
          <Section title="Register agent card">
            <div className="grid gap-2 md:grid-cols-2">
              <Input placeholder="agent-id" value={agentId} onChange={(e) => setAgentId(e.target.value)} />
              <Input placeholder="Display name" value={agentName} onChange={(e) => setAgentName(e.target.value)} />
              <Input
                className="md:col-span-2"
                placeholder="Endpoint URL (optional)"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
              />
            </div>
            <Button className="mt-3" size="sm" disabled={busy === "register"} onClick={() => void handleRegister()}>
              {busy === "register" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Register card
            </Button>
          </Section>

          <Section title="Agent cards">
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cards yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border border-border">
                {cards.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span>
                      <Network className="mr-1 inline h-4 w-4" />
                      {c.name} <span className="text-muted-foreground">({c.agentId})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{c.status}</Badge>
                      <Button size="sm" variant="outline" disabled={busy === `health-${c.agentId}`} onClick={() => void handleHealth(c)}>
                        Health
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Tasks">
            <div className="flex flex-wrap gap-2">
              <Input placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
              <Input placeholder="Target agent" value={targetAgentId} onChange={(e) => setTargetAgentId(e.target.value)} />
              <Button size="sm" disabled={busy === "task"} onClick={() => void handleCreateTask()}>
                Create task
              </Button>
            </div>
            {tasks.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              <ul className="mt-3 divide-y rounded-lg border border-border">
                {tasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                    <span>
                      {t.title} <Badge className="ml-2" variant="secondary">{t.status}</Badge>
                    </span>
                    <Button size="sm" variant="outline" disabled={busy === "env"} onClick={() => void handleSendEnvelope(t.id)}>
                      <Send className="mr-1 h-3 w-3" /> Envelope
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {log.length > 0 ? (
            <Section title="Activity log">
              {log.map((line, i) => (
                <p key={i} className="text-xs text-muted-foreground">{line}</p>
              ))}
            </Section>
          ) : null}
        </div>
      )}
    </ConsoleShell>
  );
}
