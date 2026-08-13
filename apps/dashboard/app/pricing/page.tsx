import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/site-metadata";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { PUBLIC_PLAN_CATALOG, SALES_PLAN_CATALOG } from "~/lib/plan-catalog";
import { PRICING_FAQ } from "@/lib/marketing-landing";
import { HOSTED_COPY, HOSTED_PATHS, isClerkClientConfigured } from "@/lib/hosted-product";
import { formatNumber } from "@/lib/format-number";
import { cn } from "@/lib/utils";
import { Check, ArrowRight, MessagesSquare, Bot, Webhook, Shield, Server, Workflow, GitFork, GanttChartSquare, Zap } from "lucide-react";

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing: Fluxychat",
  description:
    "Chat, AI agents, and platform modules on one plan. Free tier to Growth, undercutting Pusher and Ably on message quotas.",
  path: "/pricing",
});

const clerkOn = isClerkClientConfigured();
const planEntries = Object.entries(PUBLIC_PLAN_CATALOG);
const planKeys = planEntries.map(([k]) => k);

function formatLimit(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

const COMPARISON_ROWS: { feature: string; values: Record<string, string> }[] = [
  {
    feature: "Messages / month",
    values: Object.fromEntries(planEntries.map(([k, p]) => [k, p.messages === -1 ? "Unlimited" : formatLimit(p.messages)])),
  },
  {
    feature: "Agent invokes / month",
    values: Object.fromEntries(planEntries.map(([k, p]) => [k, p.agents === -1 ? "Unlimited" : formatLimit(p.agents)])),
  },
  {
    feature: "Webhook deliveries / month",
    values: Object.fromEntries(planEntries.map(([k, p]) => [k, p.webhooks === -1 ? "Unlimited" : formatLimit(p.webhooks)])),
  },
  { feature: "Rooms", values: Object.fromEntries(planKeys.map((k) => [k, "Unlimited"])) },
  { feature: "Projects", values: { free: "1", starter: "1", pro: "1", team: "5", growth: "Multiple" } },
  { feature: "Team seats", values: { free: "1", starter: "1", pro: "1", team: "5", growth: "Unlimited" } },
  { feature: "SDK & dashboard", values: Object.fromEntries(planKeys.map((k) => [k, "✓"])) },
  { feature: "Platform modules", values: Object.fromEntries(planKeys.map((k) => [k, "Stream, collab, game, IoT"])) },
  { feature: "AI agents", values: Object.fromEntries(planKeys.map((k) => [k, "✓"])) },
  { feature: "Webhooks", values: { free: "—", starter: "Signed + retries", pro: "✓", team: "✓", growth: "✓" } },
  { feature: "GDPR export", values: { free: "—", starter: "✓", pro: "✓", team: "✓", growth: "✓" } },
  { feature: "Priority support", values: { free: "Community", starter: "Email (best effort)", pro: "Priority", team: "Priority", growth: "Priority" } },
  { feature: "SSO / SAML", values: { free: "—", starter: "—", pro: "—", team: "—", growth: "Add-on" } },
  { feature: "Audit logs", values: { free: "—", starter: "—", pro: "—", team: "—", growth: "Add-on" } },
];

function PricingHero() {
  return (
    <section className="relative overflow-hidden border-b border-white/10 bg-slate-950 px-4 pt-24 pb-16 sm:px-6 sm:pt-28 sm:pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,115,94,0.12)_0%,transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl text-center">
        <Badge className="mb-4 border border-orange-400/40 bg-orange-500/15 px-4 py-1.5 text-sm font-medium text-orange-100 hover:bg-orange-500/20">
          Simple, transparent pricing
        </Badge>
        <h1 className="font-heading text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Pricing
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300">
          One plan covers chat, AI agents, webhooks, and platform modules (stream, collab, game, IoT). Starter at
          $20/mo, less than Pusher Startup at $49/mo for similar traffic.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="bg-[var(--fluxy-cta-color)] text-white hover:opacity-90">
            <Link href={clerkOn ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted}>
              {HOSTED_COPY.startFree}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
            <a href="mailto:fluxychat@outlook.com?subject=FluxyChat%20sales">Talk to sales</a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function PlanCards() {
  return (
    <section className="border-b border-white/10 bg-slate-950 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-lg rounded-xl border border-white/15 bg-slate-900/60 p-4 text-center">
          <p className="text-sm text-slate-200">
            All plans include{" "}
            <span className="font-semibold text-white">unlimited rooms</span>,{" "}
            <span className="font-semibold text-white">unlimited team members</span>, and{" "}
            <span className="font-semibold text-white">end-to-end WebSocket connections</span>.
          </p>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {planEntries.map(([key, plan]) => {
            const isFeatured = key === "starter";
            const showCta = key !== "growth";
            return (
              <div
                key={key}
                className={cn(
                  "relative flex min-w-0 flex-col rounded-2xl border p-6 pt-8 transition-shadow duration-300",
                  isFeatured
                    ? "z-[1] border-primary bg-slate-900/80 shadow-[0_0_0_1px_rgba(255,115,94,0.35)] hover:shadow-[0_0_20px_rgba(255,115,94,0.15)]"
                    : "border-white/10 bg-slate-900/40 hover:border-white/20",
                )}
              >
                {isFeatured ? (
                  <Badge className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap bg-primary text-primary-foreground shadow-md">
                    Most teams start here
                  </Badge>
                ) : null}
                <h3 className="font-heading text-xl font-semibold text-white">{plan.label}</h3>
                <div className="mt-2 text-4xl font-bold text-white">{plan.price}</div>
                <p className="mt-3 text-sm text-slate-300">{plan.tagline}</p>
                <div className="mt-6 flex flex-1 flex-col">
                  <ul className="flex flex-col gap-3 text-sm text-slate-300">
                    <li className="flex min-w-0 gap-2">
                      <MessagesSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 break-words">
                        {plan.messages === -1
                          ? "Unlimited messages (fair use)"
                          : `${formatNumber(plan.messages)} messages / month`}
                      </span>
                    </li>
                    <li className="flex min-w-0 gap-2">
                      <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 break-words">
                        {plan.agents === -1
                          ? "Unlimited agent invokes (fair use)"
                          : `${formatNumber(plan.agents)} agent invokes / month`}
                      </span>
                    </li>
                    <li className="flex min-w-0 gap-2">
                      <Webhook className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 break-words">
                        {plan.webhooks === -1
                          ? "Unlimited webhook deliveries (fair use)"
                          : `${formatNumber(plan.webhooks)} webhook deliveries / month`}
                      </span>
                    </li>
                  </ul>
                  <ul className="mt-4 space-y-3 border-t border-white/10 pt-4 text-sm text-slate-300">
                    {plan.bullets.map((b) => (
                      <li key={b} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        <span className="break-words">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                {showCta ? (
                  <Button
                    asChild
                    className={cn(
                      "mt-8 w-full",
                      isFeatured
                        ? "bg-[var(--fluxy-cta-color)] text-white hover:opacity-90"
                        : "bg-white/10 text-white hover:bg-white/20",
                    )}
                    variant={isFeatured ? "default" : "secondary"}
                  >
                    <Link href={clerkOn ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted}>
                      {key === "free"
                        ? HOSTED_COPY.startFree
                        : clerkOn
                          ? `Choose ${plan.label}`
                          : HOSTED_COPY.connectAccount}
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="secondary" className="mt-8 w-full bg-white/10 text-white hover:bg-white/20">
                    <Link href="/contact?plan=growth">Contact sales</Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-14 max-w-xl text-center">
          <p className="text-sm font-medium text-slate-300">
            Enterprise-grade plans for larger deployments
          </p>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {SALES_PLAN_CATALOG.map((plan) => (
            <div
              key={plan.label}
              className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/30 p-6"
            >
              <h3 className="font-heading text-lg font-semibold text-white">{plan.label}</h3>
              <div className="mt-1 text-2xl font-bold text-white">{plan.price}</div>
              <p className="mt-2 text-sm text-slate-300">{plan.tagline}</p>
              <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm text-slate-300">
                {plan.bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span className="break-words">{b}</span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="secondary" className="mt-6 w-full bg-white/10 text-white hover:bg-white/20">
                <a href={plan.href}>{plan.cta}</a>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComparisonTable() {
  return (
    <section className="border-b border-white/10 bg-slate-950 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-heading text-2xl font-bold text-white">Compare plans side by side</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-300">
          Every feature, every plan. No hidden limits.
        </p>

        <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-slate-900/60">
                <th className="px-4 py-3 font-medium text-slate-200 sm:px-6">Feature</th>
                {planEntries.map(([key, plan]) => (
                  <th key={key} className="px-4 py-3 text-center font-medium text-slate-200 sm:px-6">
                    {plan.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, i) => (
                <tr key={row.feature} className={cn(i !== COMPARISON_ROWS.length - 1 && "border-b border-white/5")}>
                  <td className="px-4 py-3 text-slate-200 sm:px-6">{row.feature}</td>
                  {planKeys.map((key) => {
                    const val = row.values[key] ?? "—";
                    const isCheck = val === "✓";
                    const isDash = val === "—";
                    return (
                      <td key={key} className="px-4 py-3 text-center sm:px-6">
                        {isCheck ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-400" />
                        ) : isDash ? (
                          <span className="text-slate-500">—</span>
                        ) : (
                          <span className="text-slate-300">{val}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function FeatureShowcase() {
  const features = [
    { icon: Server, title: "Cloudflare Workers", desc: "Edge-deployed on Cloudflare's global network. 300+ locations, sub-10ms latency." },
    { icon: Shield, title: "End-to-end encryption", desc: "TLS by default. Double Ratchet encryption for private rooms (roadmap)." },
    { icon: Workflow, title: "AI agent platform", desc: "Built-in AI agents with streaming markdown, MCP tools, and WorkflowAgent." },
    { icon: GitFork, title: "14 platform adapters", desc: "React, Vue, Svelte, React Native, Node, Express, Fastify, and more." },
    { icon: GanttChartSquare, title: "Operator console", desc: "Full dashboard for room management, analytics, billing, and team management." },
    { icon: Zap, title: "Real-time sync", desc: "Durable Objects + WebSocket. CRDT sync for collaborative features." },
  ];

  return (
    <section className="border-b border-white/10 bg-slate-950 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-heading text-2xl font-bold text-white">Everything you need to ship real-time</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-300">
          All plans include the full FluxyChat platform. No feature gating on core functionality.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-white/10 bg-slate-900/60 p-5">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold text-white">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-300">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingFaq() {
  return (
    <section className="border-b border-white/10 bg-slate-950 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-heading text-2xl font-bold text-white">Frequently asked questions</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-300">
          Everything you need to know about FluxyChat pricing.
        </p>
        <div className="mx-auto mt-8 max-w-2xl space-y-3">
          {PRICING_FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3 open:bg-slate-900/60"
            >
              <summary className="cursor-pointer list-none text-sm font-medium text-slate-200 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  {item.q}
                  <span className="text-slate-400 transition group-open:rotate-180">▾</span>
                </span>
              </summary>
              <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-relaxed text-slate-300">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingCta() {
  return (
    <section className="bg-slate-950 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight text-white">
          Start building for free
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-300">
          No credit card required. Join thousands of developers building real-time apps on FluxyChat.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="bg-[var(--fluxy-cta-color)] text-white hover:opacity-90">
            <Link href={clerkOn ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted}>
              {HOSTED_COPY.startFree}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
            <Link href={HOSTED_PATHS.landing}>Learn more about FluxyChat</Link>
          </Button>
        </div>
        <p className="mt-6 text-sm text-slate-400">
          Need enterprise SSO, VPC-style isolation, or custom SLOs?{" "}
          <a className="text-slate-300 underline underline-offset-2" href="mailto:fluxychat@outlook.com">
            Email us
          </a>
          .
        </p>
      </div>
    </section>
  );
}

function PricingFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-between gap-4 text-sm text-slate-400 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} FluxyChat. Open source MIT.</p>
          <nav className="flex gap-6">
            <Link href={HOSTED_PATHS.landing} className="hover:text-white">Product</Link>
            <Link href={HOSTED_PATHS.docs} className="hover:text-white">Docs</Link>
            <Link href={HOSTED_PATHS.compare} className="hover:text-white">Compare</Link>
            <Link href={HOSTED_PATHS.status} className="hover:text-white">Status</Link>
            <a href="mailto:fluxychat@outlook.com" className="hover:text-white">Contact</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export default function PricingPage() {
  return (
    <>
      <PricingHero />
      <PlanCards />
      <ComparisonTable />
      <FeatureShowcase />
      <PricingFaq />
      <PricingCta />
      <PricingFooter />
    </>
  );
}
