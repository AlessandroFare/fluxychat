"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Filter,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
  Zap,
} from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "../components/ui";
import { useDashboardSession } from "../components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type StageId =
  | "input-validation"
  | "context-injection"
  | "safety-filter"
  | "response-transform"
  | "pii-redaction"
  | "cache-layer"
  | "logging";

interface StageConfig {
  id: StageId;
  label: string;
  description: string;
  icon: typeof Shield;
  configurable: boolean;
}

interface MiddlewareState {
  active: Record<StageId, boolean>;
  contextInjectionPrompt: string;
  safetyBlockedPatterns: string[];
  safetyPatternInput: string;
  inputValidationMaxLen: number;
  cacheTtl: number;
  logLevel: "off" | "info" | "debug";
}

interface TestResult {
  stage: StageId;
  status: "pass" | "blocked" | "modified" | "error";
  message: string;
  detail?: unknown;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const STAGES: readonly StageConfig[] = [
  {
    id: "input-validation",
    label: "Input Validation",
    description: "Validate message structure, length limits, and required fields before processing.",
    icon: ShieldCheck,
    configurable: true,
  },
  {
    id: "context-injection",
    label: "Context Injection",
    description: "Inject system prompts, RAG context, or conversation history into the LLM call.",
    icon: Layers,
    configurable: true,
  },
  {
    id: "safety-filter",
    label: "Safety Filter",
    description: "Block messages matching banned patterns. Content moderation before LLM inference.",
    icon: Shield,
    configurable: true,
  },
  {
    id: "pii-redaction",
    label: "PII Redaction",
    description: "Detect and redact personally identifiable information before sending to the LLM.",
    icon: AlertTriangle,
    configurable: false,
  },
  {
    id: "cache-layer",
    label: "Cache Layer",
    description: "Cache repeated LLM calls to reduce latency and cost. Configurable TTL.",
    icon: Zap,
    configurable: true,
  },
  {
    id: "response-transform",
    label: "Response Transform",
    description: "Transform LLM output: strip fields, format text, enforce response schema.",
    icon: Wand2,
    configurable: false,
  },
  {
    id: "logging",
    label: "Logging & Tracing",
    description: "Log all middleware stages with OpenTelemetry spans for observability.",
    icon: Filter,
    configurable: true,
  },
];

const DEFAULT_STATE: MiddlewareState = {
  active: {
    "input-validation": true,
    "context-injection": true,
    "safety-filter": true,
    "pii-redaction": false,
    "cache-layer": false,
    "response-transform": true,
    logging: true,
  },
  contextInjectionPrompt:
    "You are a helpful assistant. Be concise and accurate. Always cite sources when available.",
  safetyBlockedPatterns: ["password", "credit card", "ssn", "api key"],
  safetyPatternInput: "",
  inputValidationMaxLen: 4096,
  cacheTtl: 300,
  logLevel: "info",
};

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function MiddlewarePage() {
  const { adminJwt, memberJwt } = useDashboardSession();
  const workerUrl = getPublicWorkerUrl();

  const [state, setState] = useState<MiddlewareState>(DEFAULT_STATE);
  const [testMessage, setTestMessage] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [testOutput, setTestOutput] = useState<string | null>(null);

  const authHeader = useMemo(() => {
    const token = adminJwt.trim() || memberJwt.trim();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [adminJwt, memberJwt]);

  const toggleStage = useCallback((id: StageId) => {
    setState((prev) => ({
      ...prev,
      active: { ...prev.active, [id]: !prev.active[id] },
    }));
  }, []);

  const addSafetyPattern = useCallback(() => {
    const pattern = state.safetyPatternInput.trim();
    if (!pattern) return;
    setState((prev) => ({
      ...prev,
      safetyBlockedPatterns: [...prev.safetyBlockedPatterns, pattern],
      safetyPatternInput: "",
    }));
  }, [state.safetyPatternInput]);

  const removeSafetyPattern = useCallback((pattern: string) => {
    setState((prev) => ({
      ...prev,
      safetyBlockedPatterns: prev.safetyBlockedPatterns.filter((p) => p !== pattern),
    }));
  }, []);

  const resetConfig = useCallback(() => {
    setState(DEFAULT_STATE);
    setTestResults(null);
    setTestOutput(null);
  }, []);

  const runTest = useCallback(async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResults(null);
    setTestOutput(null);

    // Simulate the middleware pipeline locally for demonstration
    const results: TestResult[] = [];
    let modifiedMessage = testMessage;

    // input-validation
    if (state.active["input-validation"]) {
      if (modifiedMessage.length > state.inputValidationMaxLen) {
        results.push({
          stage: "input-validation",
          status: "blocked",
          message: `Message exceeds max length of ${state.inputValidationMaxLen} characters.`,
        });
        setTestResults(results);
        setTesting(false);
        return;
      }
      results.push({
        stage: "input-validation",
        status: "pass",
        message: "Message structure and length are valid.",
      });
    }

    // context-injection
    if (state.active["context-injection"]) {
      modifiedMessage = `${state.contextInjectionPrompt}\n\n---\n\nUser: ${modifiedMessage}`;
      results.push({
        stage: "context-injection",
        status: "modified",
        message: "System prompt injected. Message now includes context preamble.",
        detail: { promptLength: state.contextInjectionPrompt.length },
      });
    }

    // safety-filter
    if (state.active["safety-filter"]) {
      const matched = state.safetyBlockedPatterns.find((p) =>
        modifiedMessage.toLowerCase().includes(p.toLowerCase()),
      );
      if (matched) {
        results.push({
          stage: "safety-filter",
          status: "blocked",
          message: `Message blocked: matched pattern "${matched}".`,
        });
        setTestResults(results);
        setTesting(false);
        return;
      }
      results.push({
        stage: "safety-filter",
        status: "pass",
        message: "No blocked patterns detected.",
        detail: { patternsChecked: state.safetyBlockedPatterns.length },
      });
    }

    // pii-redaction
    if (state.active["pii-redaction"]) {
      const emailPattern = /[\w.-]+@[\w.-]+\.\w+/g;
      const phonePattern = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
      const before = modifiedMessage;
      modifiedMessage = modifiedMessage
        .replace(emailPattern, "[REDACTED_EMAIL]")
        .replace(phonePattern, "[REDACTED_PHONE]");
      if (before !== modifiedMessage) {
        results.push({
          stage: "pii-redaction",
          status: "modified",
          message: "PII detected and redacted (emails, phone numbers).",
        });
      } else {
        results.push({
          stage: "pii-redaction",
          status: "pass",
          message: "No PII patterns detected.",
        });
      }
    }

    // cache-layer
    if (state.active["cache-layer"]) {
      results.push({
        stage: "cache-layer",
        status: "pass",
        message: `Cache check complete (TTL: ${state.cacheTtl}s). Cache miss. Forwarding to LLM.`,
      });
    }

    // response-transform (simulated)
    if (state.active["response-transform"]) {
      results.push({
        stage: "response-transform",
        status: "pass",
        message: "Response transform registered. Will apply on LLM output.",
      });
    }

    // logging
    if (state.active.logging) {
      results.push({
        stage: "logging",
        status: "pass",
        message: `Pipeline logged at ${state.logLevel} level. ${results.length} stages traced.`,
      });
    }

    setTestResults(results);
    setTestOutput(modifiedMessage);
    setTesting(false);
  }, [testMessage, state]);

  const activeCount = Object.values(state.active).filter(Boolean).length;

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="LLM Middleware Configurator"
        description={
          <>
            Configure the pluggable middleware pipeline that intercepts and transforms LLM calls.
            Toggle stages, set custom prompts, define blocked patterns, and test messages.{" "}
            <Link href="/docs" className="text-brand underline underline-offset-2">
              Middleware docs →
            </Link>
          </>
        }
        actions={
          <Button variant="outline" size="sm" onClick={resetConfig}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            Reset
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        {activeCount} of {STAGES.length} stages active
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Left: Stage configuration */}
        <div className="min-w-0 space-y-4">
          {/* Stage toggles */}
          <Panel title="Pipeline stages">
            <div className="space-y-3">
              {STAGES.map((stage) => {
                const isActive = state.active[stage.id];
                const Icon = stage.icon;
                return (
                  <div
                    key={stage.id}
                    className={cn(
                      "rounded-lg border p-3 transition-colors",
                      isActive
                        ? "border-primary/20 bg-primary/5"
                        : "border-border bg-muted/20 opacity-60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-foreground">{stage.label}</h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">{stage.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleStage(stage.id)}
                        className={cn(
                          "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
                          isActive ? "bg-primary" : "bg-muted",
                        )}
                        aria-label={`Toggle ${stage.label}`}
                        role="switch"
                        aria-checked={isActive}
                      >
                        <span
                          className={cn(
                            "block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                            isActive ? "translate-x-5" : "translate-x-0",
                          )}
                        />
                      </button>
                    </div>

                    {/* Stage-specific config */}
                    {isActive && stage.configurable ? (
                      <div className="mt-3 border-t border-border/50 pt-3">
                        {stage.id === "context-injection" && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                              System prompt
                            </label>
                            <Textarea
                              value={state.contextInjectionPrompt}
                              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                setState((prev) => ({
                                  ...prev,
                                  contextInjectionPrompt: e.target.value,
                                }))
                              }
                              rows={3}
                              className="text-sm"
                            />
                          </div>
                        )}

                        {stage.id === "safety-filter" && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                              Blocked patterns
                            </label>
                            <div className="mb-2 flex flex-wrap gap-1.5">
                              {state.safetyBlockedPatterns.map((pattern) => (
                                <span
                                  key={pattern}
                                  className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                                >
                                  {pattern}
                                  <button
                                    onClick={() => removeSafetyPattern(pattern)}
                                    className="text-red-400 hover:text-red-600"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Input
                                value={state.safetyPatternInput}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  setState((prev) => ({
                                    ...prev,
                                    safetyPatternInput: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addSafetyPattern();
                                  }
                                }}
                                placeholder="Add a blocked pattern…"
                                className="text-sm"
                              />
                              <Button variant="outline" size="sm" onClick={addSafetyPattern}>
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {stage.id === "input-validation" && (
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="text-xs font-medium text-muted-foreground">
                              Max message length
                            </label>
                            <Input
                              type="number"
                              value={state.inputValidationMaxLen}
                              onChange={(e) =>
                                setState((prev) => ({
                                  ...prev,
                                  inputValidationMaxLen: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="h-8 w-32 text-sm"
                            />
                            <span className="text-xs text-muted-foreground">characters</span>
                          </div>
                        )}

                        {stage.id === "cache-layer" && (
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="text-xs font-medium text-muted-foreground">
                              Cache TTL
                            </label>
                            <Input
                              type="number"
                              value={state.cacheTtl}
                              onChange={(e) =>
                                setState((prev) => ({
                                  ...prev,
                                  cacheTtl: parseInt(e.target.value) || 0,
                                }))
                              }
                              className="h-8 w-32 text-sm"
                            />
                            <span className="text-xs text-muted-foreground">seconds</span>
                          </div>
                        )}

                        {stage.id === "logging" && (
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="text-xs font-medium text-muted-foreground">
                              Log level
                            </label>
                            <select
                              value={state.logLevel}
                              onChange={(e) =>
                                setState((prev) => ({
                                  ...prev,
                                  logLevel: e.target.value as MiddlewareState["logLevel"],
                                }))
                              }
                              className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                            >
                              <option value="off">Off</option>
                              <option value="info">Info</option>
                              <option value="debug">Debug</option>
                            </select>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* Right: Test pipeline */}
        <div className="min-w-0 space-y-4">
          <Panel title="Test message">
            <div className="space-y-3">
              <Textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={4}
                placeholder="Type a message to run through the middleware pipeline…"
                className="text-sm"
              />
              <Button
                variant="default"
                disabled={testing || !testMessage.trim()}
                onClick={() => void runTest()}
                className="w-full"
              >
                {testing ? (
                  <>
                    <span className="mr-1 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play className="mr-1 h-3.5 w-3.5" />
                    Run through pipeline
                  </>
                )}
              </Button>
            </div>
          </Panel>

          {/* Pipeline results */}
          {testResults ? (
            <Panel title="Pipeline results">
              <div className="space-y-2">
                {testResults.map((result, idx) => {
                  const stage = STAGES.find((s) => s.id === result.stage);
                  const Icon = stage?.icon ?? Shield;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-lg border p-2.5",
                        result.status === "blocked"
                          ? "border-red-200 bg-red-50"
                          : result.status === "modified"
                            ? "border-amber-200 bg-amber-50"
                            : result.status === "error"
                              ? "border-red-200 bg-red-50"
                              : "border-emerald-200 bg-emerald-50",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground">
                          {stage?.label ?? result.stage}
                        </span>
                        <StatusBadge status={result.status} />
                      </div>
                      <p className="mt-1 pl-5.5 text-xs text-muted-foreground">{result.message}</p>
                    </div>
                  );
                })}
              </div>
            </Panel>
          ) : null}

          {/* Transformed output */}
          {testOutput ? (
            <Panel title="Transformed output">
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
                {testOutput}
              </pre>
            </Panel>
          ) : null}
        </div>
      </div>

      {/* Call Options SDK module */}
      <Panel className="mt-8 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 h-5 w-5 text-purple-500" />
          <div>
            <h3 className="text-sm font-semibold">Call Options Schema (callOptionsSchema)</h3>
            <p className="text-xs text-muted-foreground">
              Type-safe runtime config for AI calls: models, instructions, tools, temperature, maxTokens, all dynamic via prepareCall().
              Supports InferCallOptions for full type inference at the call site.
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
              <span><strong>Schema:</strong> callOptionsSchema()</span>
              <span><strong>Runtime:</strong> prepareCall() merges defaults + overrides</span>
              <span><strong>Factory:</strong> createAgentWithCallOptions()</span>
            </div>
          </div>
        </div>
      </Panel>
    </ConsoleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }: { status: TestResult["status"] }) {
  const config: Record<string, { label: string; className: string }> = {
    pass: { label: "Pass", className: "bg-emerald-100 text-emerald-800" },
    blocked: { label: "Blocked", className: "bg-red-100 text-red-800" },
    modified: { label: "Modified", className: "bg-amber-100 text-amber-800" },
    error: { label: "Error", className: "bg-red-100 text-red-800" },
  };
  const c = config[status] ?? config.pass;
  return (
    <span
      className={cn(
        "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        c.className,
      )}
    >
      {status === "pass" ? <CheckCircle2 className="h-3 w-3" /> : null}
      {status === "blocked" ? <AlertTriangle className="h-3 w-3" /> : null}
      {c.label}
    </span>
  );
}
