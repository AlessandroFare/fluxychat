import Link from "next/link";
import { COMETCHAT_PRICES } from "@/lib/compare-vendor-prices";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { buildPageMetadata } from "@/lib/site-metadata";
import { MarketingShell } from "../../components/marketing-shell";

export const metadata = buildPageMetadata({
  title: "FluxyChat vs CometChat pricing",
  description:
    "CometChat Chat MAU and Agent credit list prices from cometchat.com/pricing.md, checked 30 Sep 2026.",
  path: "/compare/cometchat",
});

export default function CompareCometChatPage() {
  const prices = COMETCHAT_PRICES;
  return (
    <MarketingShell className="py-16">
      <p className="text-sm text-muted-foreground">
        <Link href={HOSTED_PATHS.compare} className="text-brand underline underline-offset-2">
          ← Compare
        </Link>
      </p>
      <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
        FluxyChat vs CometChat
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        CometChat splits Chat (MAU plans) and AI agents (credits). FluxyChat keeps humans and the agent on the same
        room object. Hosted is beta. MIT self-host if you want the Worker in your Cloudflare account.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Chat and agent numbers from{" "}
        <a href={prices.chatSourceUrl} className="text-brand underline underline-offset-2">
          cometchat.com/pricing.md
        </a>
        . Their file says last verified {prices.chatVerifiedOnPage}. We opened it again on {prices.asOf}.
      </p>

      <h2 className="mt-10 font-heading text-xl font-semibold">Chat (yearly, monthly equivalent)</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{prices.chatNote}</p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[480px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3">MAU</th>
              <th className="px-4 py-3">Basic</th>
              <th className="px-4 py-3">Advanced</th>
              <th className="px-4 py-3">Enterprise</th>
            </tr>
          </thead>
          <tbody>
            {prices.chatYearlyRows.map((row) => (
              <tr key={row.mau} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{row.mau}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.basic}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.advanced}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.enterprise}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 font-heading text-xl font-semibold">AI Agent credits</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        {prices.agentRows.map((row) => (
          <li key={row.plan}>
            <span className="font-medium text-foreground">{row.plan}.</span> {row.list}
          </li>
        ))}
      </ul>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{prices.extraCredits}</p>

      <h2 className="mt-10 font-heading text-xl font-semibold">Where FluxyChat is a different product</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        We do not sell MAU. You pay Cloudflare for the Worker, D1, and DO. Approvals are room HITL, including an
        ephemeral room from <code className="text-foreground">requireApproval()</code> if you never built chat UI.
        Quorum still wins over a single SDK HMAC.
      </p>
    </MarketingShell>
  );
}
