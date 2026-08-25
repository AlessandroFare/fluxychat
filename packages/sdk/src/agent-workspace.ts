import { createToolCallPart, createToolResultPart, type UIPart } from "./generative-ui";

export type AgentWorkspaceStepStatus = "pending" | "running" | "completed" | "failed";

export type AgentWorkspaceStepCategory =
  | "thinking"
  | "search"
  | "research"
  | "code"
  | "browser"
  | "file"
  | "data"
  | "generic";

export interface AgentWorkspaceToolEvent {
  key: string;
  kind: "tool_call" | "tool_result" | "tool_error";
  runId: string;
  toolCallId: string;
  name: string;
  arguments?: string;
  resultPreview?: string | null;
  error?: string | null;
  parentRunId?: string | null;
  parentToolCallId?: string | null;
  nestDepth?: number;
}

export interface AgentWorkspaceStep {
  id: string;
  runId: string;
  toolName: string;
  label: string;
  status: AgentWorkspaceStepStatus;
  category: AgentWorkspaceStepCategory;
  argsPreview?: string;
  resultPreview?: string;
  error?: string;
  parentToolCallId?: string | null;
  nestDepth?: number;
  children?: AgentWorkspaceStep[];
}

export interface AgentWorkspaceContext {
  agentTyping?: boolean;
  runPending?: boolean;
  runStatus?: string | null;
  pendingToolType?: string | null;
  agentName?: string;
}

const TOOL_LABELS: Record<string, string> = {
  web_search: "Searching the web",
  "web-search": "Searching the web",
  search_web: "Searching the web",
  deep_research: "Running deep research",
  "deep-research": "Running deep research",
  read_file: "Reading a file",
  write_file: "Writing a file",
  edit_file: "Editing a file",
  run_code: "Running code",
  execute_code: "Executing code",
  browser: "Using the browser",
  computer_use: "Using the browser",
  browse: "Browsing",
  sql_query: "Querying data",
  fetch_url: "Fetching a link",
  send_message: "Sending a message",
  create_poll: "Creating a poll",
  run_agent: "Delegating to an agent",
  invoke_agent: "Delegating to an agent",
  delegate_agent: "Delegating to an agent",
};

export function normalizeToolName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

export function toolLabel(toolName: string): string {
  const key = normalizeToolName(toolName);
  if (TOOL_LABELS[key]) return TOOL_LABELS[key];
  const spaced = toolName.replace(/[_-]+/g, " ").trim();
  if (!spaced) return "Running tool";
  return `Calling ${spaced}`;
}

export function toolCategory(toolName: string): AgentWorkspaceStepCategory {
  const key = normalizeToolName(toolName);
  if (key.includes("search") || key.includes("web")) return "search";
  if (key.includes("research")) return "research";
  if (key.includes("code") || key.includes("execute") || key.includes("shell")) return "code";
  if (key.includes("browser") || key.includes("browse") || key.includes("computer")) return "browser";
  if (key.includes("file") || key.includes("read") || key.includes("write")) return "file";
  if (key.includes("sql") || key.includes("query") || key.includes("database")) return "data";
  if (key.includes("agent") || key.includes("delegate")) return "thinking";
  return "generic";
}

function pendingToolLabel(type: string | null | undefined): string | null {
  if (type === "web-search") return "Searching the web";
  if (type === "deep-research") return "Running deep research";
  if (type === "image") return "Generating an image";
  return null;
}

function pendingToolCategory(type: string | null | undefined): AgentWorkspaceStepCategory {
  if (type === "web-search") return "search";
  if (type === "deep-research") return "research";
  if (type === "image") return "generic";
  return "generic";
}

/**
 * Collapse tool_call / tool_result / tool_error events into live workspace steps.
 * Used by the shared-room agent desk UI (AG-UI companion).
 */
export function buildAgentWorkspaceSteps(
  events: AgentWorkspaceToolEvent[],
  ctx: AgentWorkspaceContext = {},
): AgentWorkspaceStep[] {
  const byToolCall = new Map<string, AgentWorkspaceStep>();
  const order: string[] = [];

  for (const ev of events) {
    const existing = byToolCall.get(ev.toolCallId);
    if (!existing) {
      order.push(ev.toolCallId);
      byToolCall.set(ev.toolCallId, {
        id: ev.toolCallId,
        runId: ev.runId,
        toolName: ev.name,
        label: toolLabel(ev.name),
        status: "running",
        category: toolCategory(ev.name),
        argsPreview: ev.arguments,
        parentToolCallId: ev.parentToolCallId ?? null,
        nestDepth: Number(ev.nestDepth) || 0,
        children: [],
      });
    }

    const step = byToolCall.get(ev.toolCallId)!;
    step.runId = ev.runId;
    step.toolName = ev.name;
    step.label = toolLabel(ev.name);
    step.category = toolCategory(ev.name);
    if (ev.parentToolCallId) step.parentToolCallId = ev.parentToolCallId;
    if (Number(ev.nestDepth) > 0) step.nestDepth = Number(ev.nestDepth);

    if (ev.kind === "tool_call") {
      step.status = "running";
      if (ev.arguments) step.argsPreview = ev.arguments;
    } else if (ev.kind === "tool_result") {
      step.status = "completed";
      if (ev.resultPreview) step.resultPreview = ev.resultPreview;
    } else if (ev.kind === "tool_error") {
      step.status = "failed";
      step.error = ev.error ?? "tool_failed";
    }
  }

  const flat = order.map((id) => byToolCall.get(id)!);
  const roots: AgentWorkspaceStep[] = [];
  for (const step of flat) {
    const parentId = step.parentToolCallId;
    if (parentId && byToolCall.has(parentId) && parentId !== step.id) {
      const parent = byToolCall.get(parentId)!;
      (parent.children ||= []).push(step);
    } else {
      roots.push(step);
    }
  }
  const steps = roots;

  function stepIsRunning(step: AgentWorkspaceStep): boolean {
    if (step.status === "running") return true;
    return (step.children || []).some(stepIsRunning);
  }

  const hasRunning = steps.some(stepIsRunning);
  const agentBusy = Boolean(ctx.agentTyping || ctx.runPending);
  const runFinished = ctx.runStatus === "completed" || ctx.runStatus === "failed";

  if (agentBusy && !hasRunning && !runFinished) {
    const pendingLabel = pendingToolLabel(ctx.pendingToolType);
    if (pendingLabel) {
      steps.unshift({
        id: "__pending_tool__",
        runId: steps[0]?.runId ?? "live",
        toolName: ctx.pendingToolType ?? "pending",
        label: pendingLabel,
        status: "running",
        category: pendingToolCategory(ctx.pendingToolType),
      });
    } else {
      steps.unshift({
        id: "__thinking__",
        runId: steps[0]?.runId ?? "live",
        toolName: "thinking",
        label: ctx.agentName ? `${ctx.agentName} is thinking…` : "Agent is thinking…",
        status: "running",
        category: "thinking",
      });
    }
  }

  return steps;
}

export function isAgentWorkspaceLive(
  steps: AgentWorkspaceStep[],
  ctx: AgentWorkspaceContext = {},
): boolean {
  function walk(list: AgentWorkspaceStep[]): boolean {
    return list.some((s) => s.status === "running" || walk(s.children || []));
  }
  if (walk(steps)) return true;
  return Boolean(ctx.agentTyping || ctx.runPending);
}

function parseStepPreview(raw: string | undefined): Record<string, unknown> | string {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : raw;
  } catch {
    return raw;
  }
}

/**
 * Map workspace steps to AG-UI UIPart[] for AgentUiRenderer (roadmap #5).
 */
export function agentWorkspaceStepsToUiParts(steps: AgentWorkspaceStep[]): UIPart[] {
  const parts: UIPart[] = [];

  for (const step of steps) {
    if (step.id === "__thinking__" || step.id === "__pending_tool__") continue;
    if (step.toolName === "thinking") continue;

    const args =
      typeof step.argsPreview === "string"
        ? (parseStepPreview(step.argsPreview) as Record<string, unknown>)
        : {};

    if (step.argsPreview || step.status === "running") {
      parts.push(createToolCallPart(step.toolName, step.id, args));
    }

    if (step.status === "completed" && step.resultPreview) {
      parts.push(
        createToolResultPart(
          step.toolName,
          step.id,
          "output-available",
          parseStepPreview(step.resultPreview),
        ),
      );
    } else if (step.status === "failed") {
      parts.push(
        createToolResultPart(
          step.toolName,
          step.id,
          "output-error",
          undefined,
          step.error ?? "tool_failed",
        ),
      );
    }

    if (step.children?.length) {
      parts.push(...agentWorkspaceStepsToUiParts(step.children));
    }
  }

  return parts;
}
