import { Card, CardContent } from "~/components/ui/card";
import {
  Boxes,
  Bot,
  CreditCard,
  FileCode2,
  GitBranch,
  LayoutTemplate,
  Mic,
  Network,
  Radio,
  ScrollText,
  Settings2,
  Shield,
  Terminal,
  Workflow,
} from "lucide-react";

const FEATURES = [
  {
    icon: Network,
    title: "Multi-platform adapters",
    description:
      "14 platform adapters (Slack, Teams, Discord, Telegram, WhatsApp, and more) behind a unified interface.",
  },
  {
    icon: ScrollText,
    title: "Streaming markdown",
    description:
      "Table buffering, code fence tracking, and inline marker healing for clean partial renders during AI streaming.",
  },
  {
    icon: CreditCard,
    title: "Card element builder",
    description:
      "Compose rich interactive messages with buttons, tables, and sections — JSX or function API, Slack Block Kit & Teams Adaptive Cards.",
  },
  {
    icon: Bot,
    title: "AI tool presets",
    description:
      "Reader, messenger, and moderator tool groups with per-tool approval gates for enterprise governance.",
  },
  {
    icon: GitBranch,
    title: "Stream resumption",
    description:
      "Reconnect to in-progress AI responses after page refresh or network drop — no lost tokens.",
  },
  {
    icon: Boxes,
    title: "MCP client",
    description:
      "Consume any MCP-compatible tool server. Auto-convert tools to LLM function-calling format.",
  },
  {
    icon: Settings2,
    title: "LLM middleware",
    description:
      "Pluggable pipeline: guardrails, caching, RAG injection, PII redaction, logging — wrapGenerate / wrapStream / transformParams.",
  },
  {
    icon: FileCode2,
    title: "DevTools web UI",
    description:
      "Visual inspector for LLM calls, tool executions, and token usage. OpenTelemetry with GenAI semantic conventions.",
  },
  {
    icon: Workflow,
    title: "WorkflowAgent",
    description:
      "Durable agent execution that survives deploys and restarts. State persisted to D1, automatic resume from last step.",
  },
  {
    icon: Shield,
    title: "Sandbox support",
    description:
      "Safely execute untrusted code in isolated environments with portable command execution.",
  },
  {
    icon: Mic,
    title: "Realtime voice",
    description:
      "Bidirectional voice-to-voice AI conversations with real-time tool calling and provider-agnostic abstraction.",
  },
  {
    icon: Radio,
    title: "And more",
    description:
      "Tool call streaming, multi-step loop control, structured output, slash commands, smoothStream, MCP Apps, and 15+ additional features.",
  },
] as const;

export function LandingWhatsNewSection() {
  return (
    <section
      id="whats-new"
      className="scroll-mt-20 border-b border-white/10 bg-gradient-to-b from-slate-950 to-slate-900 px-4 py-20 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <span className="inline-flex items-center rounded-full bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
            P22–P26 · New
          </span>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            AI-native architecture overhaul
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-300">
            AI-native architecture inspired by the Vercel Chat SDK and AI SDK.
            Cleaner abstractions, richer streaming, MCP tool calling, LLM middleware,
            and durable agent execution — without losing the real-time, multi-tenant,
            enterprise depth FluxyChat is known for.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card
              key={title}
              className="border-white/10 bg-white/5 transition-colors hover:border-white/20 hover:bg-white/[0.07]"
            >
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 ring-1 ring-inset ring-blue-500/20">
                  <Icon className="h-5 w-5 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  {description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a
            href="/devtools"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20 transition-colors hover:bg-blue-500/20"
          >
            <Terminal className="h-4 w-4" />
            Try DevTools Playground
          </a>
          <a
            href="/playground"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20 transition-colors hover:bg-blue-500/20"
          >
            <LayoutTemplate className="h-4 w-4" />
            Try Card Builder
          </a>
          <a
            href="/middleware"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20 transition-colors hover:bg-blue-500/20"
          >
            <Settings2 className="h-4 w-4" />
            Try Middleware Configurator
          </a>
        </div>

        <div className="mt-8 text-center">
          <a
            href="https://github.com/AlessandroFare/fluxychat/blob/main/docs/guides"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            Read the guides →
          </a>
        </div>
      </div>
    </section>
  );
}
