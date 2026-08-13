import Link from "next/link";
import { Bot, Check, MessageSquare, Webhook } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { PUBLIC_PLAN_CATALOG, SALES_PLAN_CATALOG, FREE_TIER_LIMITS } from "~/lib/plan-catalog";
import { PRICING_FAQ } from "@/lib/marketing-landing";
import { HOSTED_COPY, HOSTED_PATHS, isClerkClientConfigured } from "@/lib/hosted-product";
import { formatNumber } from "@/lib/format-number";
import { cn } from "@/lib/utils";

const planEntries = Object.entries(PUBLIC_PLAN_CATALOG);
const clerkOn = isClerkClientConfigured();

/** Server-rendered pricing block — keeps `landing-view` client bundle smaller (ENG-13). */
export function LandingPricingSection() {
  return (
    <section
      id="pricing"
      className="scroll-mt-20 border-b border-white/10 bg-slate-950 px-4 py-20 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-white">Pricing</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-300">
          One plan covers chat, AI agents, webhooks, and platform modules. Undercuts Pusher and Ably on message
          quotas. Starter at $20/mo vs Pusher Startup at $49/mo for similar traffic.
        </p>
        <p className="mx-auto mt-2 max-w-xl text-center text-xs text-slate-400">
          Console routes can require a one-time ack on your dashboard host. Billable usage still needs your Worker
          credentials.
        </p>
        <p className="mx-auto mt-8 max-w-xl text-center text-sm font-medium text-slate-300">
          Self-serve checkout today
        </p>

        {/* Free vs Pro summary card — qualifies traffic before the detailed grid */}
        <div className="mx-auto mt-4 max-w-lg rounded-xl border border-white/15 bg-slate-900/60 p-4 text-center">
          <p className="text-sm text-slate-200">
            <span className="font-semibold text-white">Free</span>
            {" "}includes{" "}
            <span className="font-semibold text-slate-200">
              {Intl.NumberFormat("en-US").format(FREE_TIER_LIMITS.messageLimitMonthly)}
            </span>
            {" "}messages,{" "}
            <span className="font-semibold text-slate-200">
              {Intl.NumberFormat("en-US").format(FREE_TIER_LIMITS.agentInvokeLimitMonthly)}
            </span>
            {" "}agent invokes, and{" "}
            <span className="font-semibold text-slate-200">
              {Intl.NumberFormat("en-US").format(FREE_TIER_LIMITS.webhookDeliveryLimitMonthly)}
            </span>
            {" "}webhook deliveries{" "}
            <span className="text-slate-400">/mo</span>.{" "}
            <span className="text-primary">Pro</span>{" "}
            <span className="text-slate-300">raises each to{" "}
              <span className="font-semibold text-slate-200">10×</span>{" "}for{" "}
              <span className="text-white">$50/mo</span>, ideal for production rooms with active agents.</span>
          </p>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {planEntries.map(([key, plan]) => {
            const isFeatured = key === "starter";
            return (
              <div
                key={key}
                className={cn(
                  "relative flex min-w-0 flex-col rounded-2xl border p-6 pt-8",
                  isFeatured
                    ? "z-[1] border-primary bg-slate-900/80 shadow-[0_0_0_1px_rgba(255,115,94,0.35)]"
                    : "border-white/10 bg-slate-900/40",
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
                      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 break-words">
                        {plan.messages === -1
                          ? "Unlimited messages (fair use)"
                          : `${formatNumber(plan.messages)} messages / month`}
                      </span>
                    </li>
                    <li className="flex min-w-0 gap-2">
                      <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0 break-words">
                        {plan.agents === -1
                          ? "Unlimited agent invokes (fair use)"
                          : `${formatNumber(plan.agents)} agent invokes / month`}
                      </span>
                    </li>
                    <li className="flex min-w-0 gap-2">
                      <Webhook className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
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
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                        <span className="break-words">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  asChild
                  className={cn("mt-8 w-full", isFeatured ? "" : "bg-white/10 text-white hover:bg-white/20")}
                  variant={isFeatured ? "default" : "secondary"}
                >
                  {key === "growth" ? (
                    <Link href="/contact?plan=growth">
                      {/* TODO: wire Stripe price ID for Growth when self-serve
                          checkout is ready. Currently routes to contact form. */}
                      Choose Growth
                    </Link>
                  ) : (
                    <Link href={clerkOn ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted}>
                      {key === "free"
                        ? HOSTED_COPY.startFree
                        : clerkOn
                          ? key === "starter"
                            ? "Choose Starter"
                            : key === "pro"
                              ? "Choose Pro"
                              : `Choose ${plan.label}`
                          : HOSTED_COPY.connectAccount}
                    </Link>
                  )}
                </Button>
                {key === "growth" ? (
                  <p className="mt-3 text-center text-xs text-slate-400">
                    or <Link href="/contact" className="text-slate-300 underline underline-offset-2 hover:text-white">talk to us first →</Link>
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <p className="mx-auto mt-14 max-w-xl text-center text-sm font-medium text-slate-300">
          Sales-led plans for governance and higher limits
        </p>
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
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
                    <span className="break-words">{b}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className="mt-6 w-full bg-white/10 text-white hover:bg-white/20"
                variant="secondary"
              >
                <a href={plan.href}>{plan.cta}</a>
              </Button>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-2xl space-y-3">
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

        <p className="mt-10 text-center text-xs text-slate-400">
          Need enterprise SSO, VPC-style isolation, or custom SLOs? Email{" "}
          <a className="text-slate-300 underline underline-offset-2" href="mailto:fluxychat@outlook.com">
            fluxychat@outlook.com
          </a>
          .
        </p>
      </div>
    </section>
  );
}

