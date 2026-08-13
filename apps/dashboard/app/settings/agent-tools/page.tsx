"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Shield, Plus, Trash2 } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Banner, Button, Panel, Section } from "../../components/ui";
import { useDashboardSession } from "../../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  getAgentToolPolicy,
  upsertAgentToolPolicy,
  evaluateAgentToolPolicy,
  type AgentToolPolicy,
  type AgentToolPolicyRule,
} from "@/lib/agent-tool-policy-client";

const DEFAULT_POLICY: AgentToolPolicy = {
  version: 1,
  defaultEffect: "allow",
  rules: [
    {
      id: "approve-send",
      tools: ["sendMessage", "postMessage"],
      effect: "require_approval",
      priority: 10,
      reason: "Outbound messages require HITL approval",
    },
    {
      id: "deny-delete",
      tools: ["delete_*"],
      effect: "deny",
      priority: 20,
      reason: "Destructive tools blocked by policy",
    },
  ],
};

export default function AgentToolsPolicyPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [policy, setPolicy] = useState<AgentToolPolicy>(DEFAULT_POLICY);
  const [enabled, setEnabled] = useState(true);
  const [testTool, setTestTool] = useState("sendMessage");
  const [testResult, setTestResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getAgentToolPolicy(token);
      if (data.policy) setPolicy(data.policy);
      setEnabled(data.enabled);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load tool policy"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await upsertAgentToolPolicy(token, { policy, enabled });
      setNotice("Tool policy saved.");
    } catch (err) {
      setError(messageFromUnknown(err, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    if (!token) return;
    setTestResult(null);
    try {
      const result = await evaluateAgentToolPolicy(token, { toolName: testTool });
      setTestResult(`${result.effect} (${result.ruleId}): allowed=${result.allowed}, approval=${result.requiresApproval}`);
    } catch (err) {
      setTestResult(messageFromUnknown(err, "Evaluate failed"));
    }
  }

  function updateRule(index: number, patch: Partial<AgentToolPolicyRule>) {
    setPolicy((prev) => ({
      ...prev,
      rules: prev.rules.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));
  }

  function addRule() {
    setPolicy((prev) => ({
      ...prev,
      rules: [
        ...prev.rules,
        {
          id: `rule_${prev.rules.length + 1}`,
          tools: ["myTool"],
          effect: "require_approval",
          priority: 5,
        },
      ],
    }));
  }

  function removeRule(index: number) {
    setPolicy((prev) => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Agent tool policy"
        description="JSON policy-as-code for tool allow, deny, or require_approval (EU AI Act aware)."
        icon={Shield}
      />
      <ConsoleFeedback error={error} notice={notice} />

      {loading ? (
        <div className="flex items-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <Section title="Policy rules">
          <Panel className="space-y-4 p-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Enforce tool policy for this project
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Default effect</span>
              <select
                className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={policy.defaultEffect}
                onChange={(e) => setPolicy((p) => ({ ...p, defaultEffect: e.target.value }))}
              >
                <option value="allow">allow</option>
                <option value="require_approval">require_approval</option>
                <option value="deny">deny</option>
              </select>
            </label>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Rules</span>
              <Button type="button" size="sm" variant="outline" onClick={addRule}>
                <Plus className="mr-1 h-3 w-3" /> Add rule
              </Button>
            </div>

            <ul className="space-y-3">
              {policy.rules.map((rule, index) => (
                <li key={rule.id ?? index} className="rounded-md border p-3 space-y-2 text-sm">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input
                      className="rounded-md border border-input bg-background px-2 py-1 font-mono text-xs"
                      value={(rule.tools || []).join(", ")}
                      onChange={(e) =>
                        updateRule(index, {
                          tools: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        })
                      }
                      placeholder="sendMessage, delete_*"
                    />
                    <select
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      value={rule.effect || "allow"}
                      onChange={(e) =>
                        updateRule(index, {
                          effect: e.target.value as AgentToolPolicyRule["effect"],
                        })
                      }
                    >
                      <option value="allow">allow</option>
                      <option value="require_approval">require_approval</option>
                      <option value="deny">deny</option>
                    </select>
                    <input
                      type="number"
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      value={rule.priority ?? 0}
                      onChange={(e) => updateRule(index, { priority: Number(e.target.value) || 0 })}
                      placeholder="priority"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                      value={rule.reason ?? ""}
                      onChange={(e) => updateRule(index, { reason: e.target.value })}
                      placeholder="Reason shown in audit"
                    />
                    <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => removeRule(index)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button type="button" disabled={busy || !token} onClick={() => void handleSave()}>
                Save policy
              </Button>
            </div>

            <div className="border-t pt-4 space-y-2">
              <span className="text-sm font-medium">Test evaluator</span>
              <div className="flex flex-wrap gap-2">
                <input
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  value={testTool}
                  onChange={(e) => setTestTool(e.target.value)}
                />
                <Button type="button" variant="outline" size="sm" disabled={!token} onClick={() => void handleTest()}>
                  Evaluate
                </Button>
              </div>
              {testResult ? <p className="text-xs text-muted-foreground">{testResult}</p> : null}
            </div>
          </Panel>
        </Section>
      )}

      {!token ? <Banner variant="warning">Admin JWT required.</Banner> : null}
    </ConsoleShell>
  );
}
