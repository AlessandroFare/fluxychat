/**
 * CloudflareCostTable  what running FluxyChat actually costs on CF.
 *
 * Server component. Accepts a `variant` prop: "dark" (default, for the
 * landing page dark section) or "light" (for the /compare page).
 *
 * Numbers are honest estimates tied to Cloudflare's published free + paid
 * Workers / D1 / DO limits as of 2026-06. Always link to the live pricing
 * page so they don't go stale silently.
 */
import Link from "next/link";

interface CostRow {
  plan: string;
  messages: string;
  d1Reads: string;
  cost: string;
  bestFor: string;
}

const ROWS: readonly CostRow[] = [
  {
    plan: "Workers Free",
    messages: "~3M / mo (100k req/day × 30)",
    d1Reads: "5M / day",
    cost: "$0",
    bestFor: "Hobby · early beta · <1k MAU",
  },
  {
    plan: "Workers Paid ($5/mo)",
    messages: "~300M+ / mo",
    d1Reads: "25M+ / day",
    cost: "$5 + usage",
    bestFor: "Growing SaaS · 1k–100k MAU",
  },
  {
    plan: "Self-host on your CF account",
    messages: "Unlimited*",
    d1Reads: "Your plan limits",
    cost: "Your plan cost",
    bestFor: "Enterprise · cost-sensitive · compliance",
  },
];

export function CloudflareCostTable({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const isDark = variant === "dark";
  return (
    <div
      className={
        isDark
          ? "rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8"
          : "rounded-2xl border border-border bg-card p-6 sm:p-8"
      }
    >
      <p className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-muted-foreground"}`}>
        FluxyChat runs entirely on your Cloudflare account. You pay Cloudflare
        directly  no per-seat or per-message markup from us on the self-host
        path.
      </p>
      <div className="mt-5 overflow-x-auto">
        <table data-testid="cloudflare-cost-table" className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className={`border-b ${isDark ? "border-white/10" : "border-border"}`}>
              <th className={`px-4 py-3 font-semibold ${isDark ? "text-white" : "text-foreground"}`}>Plan</th>
              <th className={`px-4 py-3 font-medium ${isDark ? "text-slate-300" : "text-muted-foreground"}`}>Monthly messages</th>
              <th className={`px-4 py-3 font-medium ${isDark ? "text-slate-300" : "text-muted-foreground"}`}>D1 reads / day</th>
              <th className={`px-4 py-3 font-medium ${isDark ? "text-slate-300" : "text-muted-foreground"}`}>Cost (USD)</th>
              <th className={`px-4 py-3 font-medium ${isDark ? "text-slate-300" : "text-muted-foreground"}`}>Best for</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, idx) => (
              <tr
                key={row.plan}
                className={
                  idx < ROWS.length - 1
                    ? isDark
                      ? "border-b border-white/10"
                      : "border-b border-border last:border-0"
                    : ""
                }
              >
                <td className={`px-4 py-3 font-semibold ${isDark ? "text-white" : "text-foreground"}`}>{row.plan}</td>
                <td className={`px-4 py-3 ${isDark ? "text-slate-200" : "text-muted-foreground"}`}>{row.messages}</td>
                <td className={`px-4 py-3 ${isDark ? "text-slate-200" : "text-muted-foreground"}`}>{row.d1Reads}</td>
                <td className={`px-4 py-3 ${isDark ? "text-slate-200" : "text-muted-foreground"}`}>{row.cost}</td>
                <td className={`px-4 py-3 ${isDark ? "text-slate-300" : "text-muted-foreground"}`}>{row.bestFor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`mt-5 text-xs leading-relaxed ${isDark ? "text-slate-400" : "text-muted-foreground"}`}>
        * D1 storage cap: 10 GB on the free plan, unlimited on paid. Message
        fanout uses Durable Object egress  see{" "}
        <Link
          href="https://developers.cloudflare.com/workers/platform/pricing"
          className={
            isDark
              ? "text-slate-300 underline underline-offset-2 hover:text-white"
              : "text-foreground underline underline-offset-2 hover:text-primary"
          }
          target="_blank"
          rel="noreferrer"
        >
          Cloudflare&apos;s current pricing
        </Link>{" "}
        for live numbers. Run{" "}
        <code className={`rounded px-1 py-0.5 text-[11px] ${isDark ? "bg-white/5 text-slate-200" : "bg-muted text-muted-foreground"}`}>
          pnpm run check:pricing
        </code>{" "}
        to verify your env assumptions match the published rates.
      </p>
    </div>
  );
}
