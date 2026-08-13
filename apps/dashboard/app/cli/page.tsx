"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Package,
  Terminal as TerminalIcon,
  ArrowRight,
} from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  CLI Data                                                                  */
/* -------------------------------------------------------------------------- */

const TEMPLATES = [
  {
    id: "basic",
    name: "basic",
    description: "Minimal FluxyChat setup: one room, real-time messaging, no auth.",
    features: ["WebSocket rooms", "REST API", "One-line embed"],
    command: "npx create-fluxy-chat my-app --template basic",
  },
  {
    id: "slack",
    name: "slack",
    description: "Slack-style workspace with channels, DMs, and presence.",
    features: ["Channels & DMs", "Presence indicators", "Threaded replies"],
    command: "npx create-fluxy-chat my-app --template slack",
  },
  {
    id: "telegram",
    name: "telegram",
    description: "Telegram-style client with bots, inline queries, and secret chats.",
    features: ["Bot framework", "Inline queries", "Secret chats"],
    command: "npx create-fluxy-chat my-app --template telegram",
  },
  {
    id: "discord",
    name: "discord",
    description: "Discord-style guild with voice-ready rooms, roles, and permissions.",
    features: ["Guild model", "Roles & permissions", "Voice-ready rooms"],
    command: "npx create-fluxy-chat my-app --template discord",
  },
] as const;

const CLI_STEPS = [
  {
    prompt: "Project name",
    description: "Enter your project name. This will be used for the directory and package.json.",
    placeholder: "my-fluxy-app",
    defaultValue: "my-fluxy-app",
  },
  {
    prompt: "Choose a template",
    description: "Select from 4 starter templates. Each comes with pre-configured adapters.",
    placeholder: "basic | slack | telegram | discord",
    defaultValue: "basic",
  },
  {
    prompt: "Select adapters",
    description: "Pick which platform adapters to include. You can add more later.",
    placeholder: "slack, telegram, discord (space to toggle)",
    defaultValue: "slack",
  },
  {
    prompt: "Configure authentication",
    description: "Choose Clerk (hosted) or JWT (self-hosted). Both work with the SDK.",
    placeholder: "clerk | jwt",
    defaultValue: "jwt",
  },
  {
    prompt: "Install dependencies?",
    description: "We'll run npm install for you. Skip if you prefer pnpm or yarn.",
    placeholder: "Yes / No",
    defaultValue: "Yes",
  },
] as const;

const QUICK_COMMANDS = [
  {
    label: "Create a project",
    command: "npx create-fluxy-chat my-app",
    description: "Run the interactive scaffolding wizard.",
  },
  {
    label: "With a template",
    command: "npx create-fluxy-chat my-app --template slack",
    description: "Skip the prompt and specify a template directly.",
  },
  {
    label: "With adapters",
    command: "npx create-fluxy-chat my-app --template discord --adapters slack,telegram",
    description: "Pre-select adapters from the CLI.",
  },
  {
    label: "Install globally",
    command: "npm install -g create-fluxy-chat",
    description: "Install the CLI globally for repeated use.",
  },
] as const;

const GITHUB_URL = "https://github.com/fluxychat/create-fluxy-chat";

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function CLIPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [terminalLines, setTerminalLines] = useState<
    Array<{ type: "input" | "output" | "prompt"; text: string }>
  >([
    { type: "output", text: "$ npx create-fluxy-chat my-app" },
    { type: "output", text: "" },
    { type: "prompt", text: "FluxyChat CLI v1.0.0" },
    { type: "output", text: "Let's scaffold your chat app!\n" },
  ]);
  const [running, setRunning] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const runStep = useCallback(
    (stepIdx: number) => {
      if (running) return;
      setRunning(true);

      const step = CLI_STEPS[stepIdx];
      const newLines = [
        { type: "prompt" as const, text: `? ${step.prompt}` },
        { type: "output" as const, text: `  ${step.description}` },
        { type: "input" as const, text: `  ❯ ${step.defaultValue}` },
        { type: "output" as const, text: "  ✓ " + step.placeholder },
        { type: "output" as const, text: "" },
      ];

      setTerminalLines((prev) => [...prev, ...newLines]);
      setCompletedSteps((prev) => new Set(prev).add(stepIdx));

      setTimeout(() => {
        setRunning(false);
        if (stepIdx < CLI_STEPS.length - 1) {
          setActiveStep(stepIdx + 1);
        } else {
          setTerminalLines((prev) => [
            ...prev,
            { type: "output", text: "✓ Project created successfully!" },
            { type: "output", text: "✓ Dependencies installed" },
            { type: "output", text: "" },
            { type: "output", text: "  cd my-app && npm run dev" },
            { type: "output", text: "" },
            { type: "output", text: "  → http://localhost:3000" },
          ]);
        }
      }, 800);
    },
    [running],
  );

  const resetDemo = useCallback(() => {
    setActiveStep(0);
    setCompletedSteps(new Set());
    setTerminalLines([
      { type: "output", text: "$ npx create-fluxy-chat my-app" },
      { type: "output", text: "" },
      { type: "prompt", text: "FluxyChat CLI v1.0.0" },
      { type: "output", text: "Let's scaffold your chat app!\n" },
    ]);
  }, []);

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="CLI Scaffolding"
        description={
          <>
            Spin up a new FluxyChat project with the <code className="text-xs">create-fluxy-chat</code> CLI.
            Choose a template, select adapters, and start building in under a minute.
          </>
        }
        actions={
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              GitHub
            </Button>
          </a>
        }
      />

      {/* Quick start commands */}
      <Panel title="Quick start" className="mb-6">
        <div className="grid gap-3 sm:grid-cols-2">
          {QUICK_COMMANDS.map((cmd) => (
            <div
              key={cmd.label}
              className="min-w-0 rounded-lg border border-border bg-muted/30 p-3"
            >
              <div className="mb-1 flex items-center gap-2">
                <TerminalIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">{cmd.label}</span>
              </div>
              <CodeBlock command={cmd.command} />
              <p className="mt-1.5 text-xs text-muted-foreground">{cmd.description}</p>
            </div>
          ))}
        </div>
      </Panel>

      {/* Interactive terminal demo */}
      <Panel
        title="Interactive demo"
        className="mb-6"
      >
        <p className="mb-3 text-sm text-muted-foreground">
          Walk through the CLI prompts step by step. Click{" "}
          <span className="font-medium text-foreground">Run step</span> to simulate each prompt.
        </p>

        {/* Step indicator */}
        <div className="mb-4 flex flex-wrap gap-2">
          {CLI_STEPS.map((step, idx) => (
            <div
              key={idx}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                completedSteps.has(idx)
                  ? "bg-emerald-100 text-emerald-800"
                  : idx === activeStep
                    ? "bg-blue-100 text-blue-800"
                    : "bg-muted text-muted-foreground",
              )}
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/60 text-[10px]">
                {completedSteps.has(idx) ? "✓" : idx + 1}
              </span>
              {step.prompt}
            </div>
          ))}
        </div>

        {/* Terminal */}
        <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
          {/* Title bar */}
          <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-900 px-3 py-2">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-500/80" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="h-3 w-3 rounded-full bg-green-500/80" />
            </div>
            <span className="ml-2 font-mono text-xs text-slate-400">Terminal: create-fluxy-chat</span>
          </div>
          {/* Terminal body */}
          <div className="max-h-80 min-h-[200px] overflow-x-hidden overflow-y-auto p-3 font-mono text-xs">
            {terminalLines.map((line, idx) => (
              <div
                key={idx}
                className={cn(
                  "whitespace-pre-wrap",
                  line.type === "input" && "text-slate-100",
                  line.type === "output" && "text-slate-400",
                  line.type === "prompt" && "font-semibold text-blue-400",
                )}
              >
                {line.text || "\u00A0"}
              </div>
            ))}
            {running ? (
              <div className="flex items-center gap-1 text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>processing…</span>
              </div>
            ) : null}
            {/* Cursor */}
            {!running && activeStep < CLI_STEPS.length ? (
              <div className="mt-1 flex items-center gap-1 text-slate-300">
                <span className="text-blue-400">?</span>
                <span>{CLI_STEPS[activeStep].prompt}</span>
                <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-slate-300" />
              </div>
            ) : null}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {activeStep < CLI_STEPS.length && !running ? (
            <Button size="sm" onClick={() => runStep(activeStep)}>
              <TerminalIcon className="mr-1 h-3 w-3" />
              Run step {activeStep + 1}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={resetDemo} disabled={running}>
            Reset
          </Button>
        </div>
      </Panel>

      {/* Templates */}
      <Panel title="Templates">
        <div className="grid gap-4 sm:grid-cols-2">
          {TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              className="min-w-0 rounded-xl border border-border bg-muted/20 p-4 transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-center gap-2">
                <Package className="h-4 w-4 text-brand" />
                <h3 className="font-mono text-sm font-semibold text-foreground">{tpl.name}</h3>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">{tpl.description}</p>
              <ul className="mb-3 space-y-1">
                {tpl.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-foreground">
                    <Check className="h-3 w-3 text-emerald-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <CodeBlock command={tpl.command} />
            </div>
          ))}
        </div>
      </Panel>

      {/* CTA */}
      <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/20 p-6 text-center">
        <h3 className="font-heading text-lg font-semibold text-foreground">
          Ready to build?
        </h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Clone the repo, read the docs, or jump straight into the quickstart guide.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Button size="lg">
              <ExternalLink className="mr-1.5 h-4 w-4" />
              Get Started
            </Button>
          </a>
          <Link href="/get-started">
            <Button variant="outline" size="lg">
              Quickstart guide
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </ConsoleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  CodeBlock with copy                                                        */
/* -------------------------------------------------------------------------- */

function CodeBlock({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [command]);

  return (
    <div className="group/code relative">
      <pre className="overflow-x-auto rounded-md bg-slate-950 p-2.5 pr-8 font-mono text-xs text-slate-300">
        {command}
      </pre>
      <button
        onClick={copy}
        className="absolute right-1.5 top-1.5 rounded p-1 text-slate-500 opacity-0 transition-opacity hover:bg-slate-800 hover:text-slate-300 group-hover/code:opacity-100"
        aria-label="Copy command"
      >
        {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}
