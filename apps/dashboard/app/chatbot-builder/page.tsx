"use client";

import { useState, useMemo } from "react";
import {
  Plus, Trash2, Play, ListChecks, GitBranch,
  Zap, Filter, ArrowRight, CheckCircle2, XCircle,
  Clock, Users, MessageSquare, Ticket, Bell,
} from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { createChatbotBuilder, type ChatbotEventType } from "@fluxy-chat/sdk";

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

type RuleEntry = { name: string; event: ChatbotEventType; action: string; conditions: string[]; priority: number };

export default function ChatbotBuilderPage() {
  const builder = useMemo(() => createChatbotBuilder(), []);
  const [rules, setRules] = useState<RuleEntry[]>([]);
  const [name, setName] = useState("");
  const [event, setEvent] = useState<ChatbotEventType>("message_received");
  const [action, setAction] = useState("send_message");
  const [conditionInput, setConditionInput] = useState("");
  const [conditions, setConditions] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<ChatbotEventType>("message_received");

  function handleAddRule() {
    if (!name.trim()) return;
    builder.addRule({
      name: name.trim(),
      priority: rules.length + 1,
      enabled: true,
      trigger: { type: event },
      conditions: conditions.map((c) => ({ field: "text", operator: "contains" as const, value: c })),
      actions: [{ type: action as any, params: { text: `Auto: ${name}` } }],
    });
    setRules([...rules, { name: name.trim(), event, action, conditions: [...conditions], priority: rules.length + 1 }]);
    setName("");
    setConditions([]);
    setConditionInput("");
    setLog((prev) => [`✅ Rule "${name.trim()}" added (on ${event} → ${action}${conditions.length ? `, ${conditions.length} condition(s)` : ""})`, ...prev.slice(0, 29)]);
  }

  function handleRemoveRule(index: number) {
    const r = rules[index];
    if (r) {
      // Find the actual rule by name in the builder
      const allRules = builder.listRules();
      const match = allRules.find((x) => x.name === r.name);
      if (match) builder.removeRule(match.id);
      setRules(rules.filter((_, i) => i !== index));
      setLog((prev) => [`🗑️ Rule "${r.name}" removed`, ...prev.slice(0, 29)]);
    }
  }

  function handleTrigger(eventType: ChatbotEventType) {
    builder.evaluateTrigger({ type: eventType }, { userId: "demo-user", text: `Test trigger for ${eventType}` }).then((triggered) => {
      setLog((prev) => [`⚡ Triggered "${eventType}" → ${triggered.length} matching rule(s)`, ...prev.slice(0, 29)]);
    });
  }

  function addCondition() {
    const c = conditionInput.trim();
    if (c && !conditions.includes(c)) {
      setConditions((p) => [...p, c]);
      setConditionInput("");
    }
  }

  const filteredRules = rules.filter((r) => r.event === selectedEvent);

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Chatbot Builder"
        description="Visual trigger-action rule engine — create rules with conditions, test them, and see execution logs. SDK-powered in-memory demo."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* Left: Rule builder */}
        <div className="space-y-4">
          <Panel className="p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Plus className="h-4 w-4" /> Create rule</h3>
            <div className="mt-3 space-y-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name (e.g. 'Welcome new users')" />

              {/* Event selector */}
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

              {/* Action selector */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Do this:</label>
                <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={action} onChange={(e) => setAction(e.target.value)}>
                  {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>

              {/* Conditions */}
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

              <Button onClick={handleAddRule} size="sm" className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add rule
              </Button>
            </div>
          </Panel>

          {/* Trigger test panel */}
          <Panel className="p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold"><Play className="h-4 w-4" /> Test events</h4>
            <p className="text-xs text-muted-foreground mt-1">Click a button to simulate an event and see which rules fire.</p>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {EVENTS.map((e) => {
                const Icon = e.icon;
                const count = rules.filter((r) => r.event === e.value).length;
                return (
                  <button key={e.value} type="button"
                    onClick={() => handleTrigger(e.value)}
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

        {/* Right: Rules list + flow visualization */}
        <div className="space-y-4">
          {/* Flow visualization header */}
          <div className="flex items-center gap-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="h-4 w-4" /> Active rules ({rules.length})</h3>
            <div className="flex gap-1">
              {EVENTS.map((e) => {
                const count = rules.filter((r) => r.event === e.value).length;
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

          {/* Flow visualization */}
          {filteredRules.length > 0 && (
            <Panel className="p-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" /> Flow: {EVENTS.find((e) => e.value === selectedEvent)?.label}
              </h4>
              <div className="space-y-2">
                {filteredRules.map((r, i) => (
                  <div key={i} className="relative">
                    {/* Connector */}
                    {i > 0 && (
                      <div className="absolute -top-2 left-3 h-2 w-px bg-border" aria-hidden />
                    )}
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                      {/* Trigger node */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 ring-1 ring-blue-500/20">
                          <Zap className="h-4 w-4 text-blue-400" />
                        </div>
                        <span className="text-[10px] text-muted-foreground max-w-[60px] truncate">{r.event.replace(/_/g, " ")}</span>
                      </div>

                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                      {/* Conditions (if any) */}
                      {r.conditions.length > 0 && (
                        <>
                          <div className="flex flex-col gap-0.5">
                            {r.conditions.map((c, j) => (
                              <Badge key={j} variant="outline" className="text-[9px]">
                                <Filter className="h-2.5 w-2.5 mr-0.5" /> {c}
                              </Badge>
                            ))}
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </>
                      )}

                      {/* Action node */}
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20 shrink-0">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{r.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize truncate">{r.action.replace(/_/g, " ")}</p>
                        </div>
                      </div>

                      {/* Remove */}
                      <button onClick={() => handleRemoveRule(rules.indexOf(r))}
                        className="shrink-0 text-muted-foreground hover:text-red-500 p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {filteredRules.length === 0 && rules.length > 0 && (
            <Panel className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No rules for "{EVENTS.find((e) => e.value === selectedEvent)?.label}". Select a different event.</p>
            </Panel>
          )}

          {rules.length === 0 && (
            <Panel className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No rules yet. Create one using the panel on the left.</p>
              <p className="text-xs text-muted-foreground mt-1">Rules define what happens when an event fires.</p>
            </Panel>
          )}

          {/* Activity log */}
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
    </ConsoleShell>
  );
}
