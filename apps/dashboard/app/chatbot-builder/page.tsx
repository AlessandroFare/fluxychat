"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus, Trash2, Play, ListChecks, GitBranch,
  Zap, Filter, ArrowRight, CheckCircle2, XCircle,
  Clock, Users, MessageSquare, Ticket, Bell, Loader2,
} from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleProjectRoomBar } from "../components/console-project-room-bar";
import { ConsoleFeedback } from "../components/console-feedback";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import type { ChatbotEventType } from "@fluxy-chat/sdk";
import { useDashboardSession } from "../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createWorkflow,
  listWorkflows,
  runWorkflow,
  updateWorkflow,
  type WorkflowDefinition,
} from "@/lib/automations-client";

const EVENTS: { value: ChatbotEventType; label: string; icon: typeof Zap }[] = [
  { value: "message_received", label: "Message received", icon: MessageSquare },
  { value: "user_joined", label: "User joined", icon: Users },
  { value: "user_left", label: "User left", icon: Users },
  { value: "reaction_added", label: "Reaction added", icon: Zap },
  { value: "ticket_created", label: "Ticket created", icon: Ticket },
  { value: "schedule", label: "Schedule", icon: Clock },
];

const ACTIONS = [
  { value: "send_message", label: "Send message", icon: MessageSquare },
  { value: "create_ticket", label: "Create ticket", icon: Ticket },
  { value: "assign_agent", label: "Assign agent", icon: Users },
  { value: "notify_channel", label: "Notify channel", icon: Bell },
  { value: "close_ticket", label: "Close ticket", icon: Ticket },
  { value: "escalate", label: "Escalate", icon: Zap },
  { value: "log_event", label: "Log event", icon: Filter },
];

function workflowEvent(wf: WorkflowDefinition): ChatbotEventType {
  const fromConfig = wf.triggerConfig?.event;
  if (typeof fromConfig === "string") return fromConfig as ChatbotEventType;
  return (wf.triggerType as ChatbotEventType) || "message_received";
}

function workflowAction(wf: WorkflowDefinition): string {
  const first = wf.actions?.[0];
  if (first && typeof first.type === "string") return first.type;
  return "send_message";
}

function workflowConditions(wf: WorkflowDefinition): string[] {
  const raw = wf.conditions?.keywords;
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === "string");
  const contains = wf.conditions?.textContains;
  return typeof contains === "string" && contains ? [contains] : [];
}

export default function ChatbotBuilderPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [event, setEvent] = useState<ChatbotEventType>("message_received");
  const [action, setAction] = useState("send_message");
  const [conditionInput, setConditionInput] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ChatbotEventType>("message_received");

  const loadWorkflows = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listWorkflows(token);
      setWorkflows(rows.filter((wf) => wf.status !== "archived"));
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load rules"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadWorkflows();
  }, [loadWorkflows]);

  async function handleAddRule() {
    if (!token || !name.trim()) return;
    const ruleName = name.trim();
    setBusy("create");
    try {
      const created = await createWorkflow(token, {
        name: ruleName,
        description: `Chatbot builder · ${event} → ${action}`,
        triggerType: event,
        triggerConfig: { source: "chatbot-builder", event },
        conditions: { keywords: conditions, textContains: conditions[0] },
        actions: [{ type: action, params: { text: `Auto: ${ruleName}` } }],
      });
      setName("");
      setConditions([]);
      setConditionInput("");
      setNotice(`Rule saved as workflow ${created.id} (draft).`);
      setLog((prev) => [`Saved "${ruleName}" on ${event} → ${action}`, ...prev.slice(0, 29)]);
      await loadWorkflows();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save rule"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRemoveRule(workflowId: string, ruleName: string) {
    if (!token) return;
    setBusy(`rm-${workflowId}`);
    try {
      await updateWorkflow(token, workflowId, { status: "archived" });
      setLog((prev) => [`Archived "${ruleName}"`, ...prev.slice(0, 29)]);
      await loadWorkflows();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to archive rule"));
    } finally {
      setBusy(null);
    }
  }

  async function handleTrigger(eventType: ChatbotEventType) {
    if (!token) return;
    const matches = workflows.filter((wf) => workflowEvent(wf) === eventType);
    for (const wf of matches) {
      try {
        const result = await runWorkflow(token, wf.id, { event: eventType, text: `Test trigger for ${eventType}` });
        setLog((prev) => [`Ran "${wf.name}" → execution ${result.id}`, ...prev.slice(0, 29)]);
      } catch (err) {
        setLog((prev) => [messageFromUnknown(err, `Run failed for ${wf.name}`), ...prev.slice(0, 29)]);
      }
    }
    if (matches.length === 0) {
      setLog((prev) => [`No persisted rules for ${eventType}`, ...prev.slice(0, 29)]);
    }
  }

  function addCondition() {
    const c = conditionInput.trim();
    if (c && !conditions.includes(c)) {
      setConditions((p) => [...p, c]);
      setConditionInput("");
    }
  }

  const filteredRules = workflows.filter((wf) => workflowEvent(wf) === selectedEvent);

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Chatbot builder"
        description="Rules save as workflows on the project. A test run starts a real execution, same store as Automations."
      />
      <ConsoleProjectRoomBar requireProject hint="Saved as draft workflows on the active project." />
      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">
          Admin JWT required. <Link href="/projects" className="font-medium underline-offset-2 hover:underline">Projects</Link>.
        </Panel>
      ) : (
      <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Panel className="p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Create rule</h3>
            <div className="mt-3 space-y-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name (e.g. 'Welcome new users')" />

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">When this happens:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {EVENTS.map((e) => {
                    const Icon = e.icon;
                    return (
                      <button key={e.value} type="button"
                        onClick={() => setEvent(e.value)}
                        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors text-left ${event === e.value ? "border-primary/30 bg-primary/5 text-foreground" : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/30"}`}>
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{e.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Do this:</label>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={action} onChange={(e) => setAction(e.target.value)}>
                  {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Conditions (optional):</label>
                <div className="flex gap-1.5">
                  <Input value={conditionInput} onChange={(e) => setConditionInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCondition(); } }}
                    placeholder="e.g. 'text contains hello'" className="flex-1 text-xs" />
                  <Button size="sm" variant="outline" onClick={addCondition}><Plus className="h-3 w-3" /></Button>
                </div>
                {conditions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {conditions.map((c, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] gap-1">
                        <Filter className="h-2.5 w-2.5" /> {c}
                        <button onClick={() => setConditions((p) => p.filter((_, j) => j !== i))}><XCircle className="h-2.5 w-2.5" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={() => void handleAddRule()} size="sm" className="w-full" disabled={busy === "create" || !name.trim()}>
                {busy === "create" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                Save rule
              </Button>
            </div>
          </Panel>

          <Panel className="p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold"><Play className="h-4 w-4" /> Test events</h4>
            <p className="text-xs text-muted-foreground mt-1">Runs matching workflows on the Worker (creates an execution row).</p>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {EVENTS.map((e) => {
                const Icon = e.icon;
                const count = workflows.filter((wf) => workflowEvent(wf) === e.value).length;
                return (
                  <button key={e.value} type="button"
                    onClick={() => void handleTrigger(e.value)}
                    className="flex items-center justify-between gap-1 rounded-md border border-border bg-muted/20 px-2.5 py-1.5 text-xs hover:bg-muted/40 transition-colors">
                    <span className="flex items-center gap-1.5">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      {e.label.split(" ")[0]}
                    </span>
                    {count > 0 ? <Badge className="text-[9px]">{count}</Badge> : null}
                  </button>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ListChecks className="h-4 w-4" /> Active rules ({loading ? "…" : workflows.length})
            </h3>
            <div className="flex gap-1">
              {EVENTS.map((e) => {
                const count = workflows.filter((wf) => workflowEvent(wf) === e.value).length;
                if (count === 0) return null;
                return (
                  <button key={e.value} type="button"
                    onClick={() => setSelectedEvent(e.value)}
                    className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${selectedEvent === e.value ? "bg-primary/10 text-primary" : "bg-muted/20 text-muted-foreground hover:bg-muted/30"}`}>
                    {e.label.split(" ")[0]} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {filteredRules.length > 0 && (
            <Panel className="p-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" /> Flow: {EVENTS.find((e) => e.value === selectedEvent)?.label}
              </h4>
              <div className="space-y-2">
                {filteredRules.map((wf, i) => {
                  const wfEvent = workflowEvent(wf);
                  const wfAction = workflowAction(wf);
                  const wfConditions = workflowConditions(wf);
                  return (
                    <div key={wf.id} className="relative">
                      {i > 0 && (
                        <div className="absolute -top-2 left-3 h-2 w-px bg-border" aria-hidden />
                      )}
                      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 ring-1 ring-blue-500/20">
                            <Zap className="h-4 w-4 text-blue-400" />
                          </div>
                          <span className="text-[10px] text-muted-foreground max-w-[60px] truncate">{wfEvent.replace(/_/g, " ")}</span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {wfConditions.length > 0 && (
                          <>
                            <div className="flex flex-col gap-0.5">
                              {wfConditions.map((c) => (
                                <Badge key={c} variant="outline" className="text-[9px]">
                                  <Filter className="h-2.5 w-2.5 mr-0.5" /> {c}
                                </Badge>
                              ))}
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          </>
                        )}
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20 shrink-0">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{wf.name}</p>
                            <p className="text-[10px] text-muted-foreground capitalize truncate">{wfAction.replace(/_/g, " ")} · {wf.status}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => void handleRemoveRule(wf.id, wf.name)}
                          disabled={busy === `rm-${wf.id}`}
                          className="shrink-0 text-muted-foreground hover:text-red-500 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}

          {filteredRules.length === 0 && workflows.length > 0 && (
            <Panel className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No rules for &quot;{EVENTS.find((e) => e.value === selectedEvent)?.label}&quot;. Select a different event.</p>
            </Panel>
          )}

          {workflows.length === 0 && (
            <Panel className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No rules yet. Create one using the panel on the left.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Same store as <Link href="/automations" className="underline underline-offset-2">Automations</Link>.
              </p>
            </Panel>
          )}

          <div>
            <h4 className="text-sm font-semibold mb-2">Activity log</h4>
            <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
              {log.length === 0 ? <p className="text-xs text-muted-foreground">Rule creation and trigger results will appear here.</p> : log.map((entry, i) => (
                <p key={i} className="text-xs text-muted-foreground">{entry}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </ConsoleShell>
  );
}
