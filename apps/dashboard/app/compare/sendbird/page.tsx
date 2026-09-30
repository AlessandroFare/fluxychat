import Link from "next/link";
import { SENDBIRD_CHAT_PRICES } from "@/lib/compare-vendor-prices";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { buildPageMetadata } from "@/lib/site-metadata";
import { MarketingShell } from "../../components/marketing-shell";

export const metadata = buildPageMetadata({
  title: "FluxyChat vs Sendbird Chat pricing",
  description:
    "Sendbird Chat MAU list prices from sendbird.com/pricing/chat, dated 30 Sep 2026, next to FluxyChat’s room Durable Object.",
  path: "/compare/sendbird",
});

export default function CompareSendbirdPage() {
  const prices = SENDBIRD_CHAT_PRICES;
  return (
    <MarketingShell className="py-16">
      <p className="text-sm text-muted-foreground">
        <Link href={HOSTED_PATHS.compare} className="text-brand underline underline-offset-2">
          ← Compare
        </Link>
      </p>
      <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
        FluxyChat vs Sendbird Chat
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Sendbird sells Chat on monthly active users. FluxyChat sells a room: chat, presence, Yjs, and{" "}
        <code className="text-foreground">invokeAgent</code> on one Cloudflare Durable Object. Hosted FluxyChat is
        still beta. Self-host is MIT on your account.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Numbers below are from{" "}
        <a href={prices.sourceUrl} className="text-brand underline underline-offset-2">
          sendbird.com/pricing/chat
        </a>{" "}
        as of {prices.asOf}. They change. Open that page before you sign anything.
      </p>

      <h2 className="mt-10 font-heading text-xl font-semibold">Public Chat list price</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        {prices.rows.map((row) => (
          <li key={row.plan}>
            <span className="font-medium text-foreground">{row.plan}.</span> {row.list}
          </li>
        ))}
      </ul>
      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">{prices.mauNote}</p>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{prices.agentNote}</p>

      <h2 className="mt-10 font-heading text-xl font-semibold">What you are actually buying</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Sendbird: UI kits, moderation SKUs, Calls as a separate product, sales-led Enterprise.</li>
        <li>
          FluxyChat: tenant rooms on Workers + D1. Guest widget with a publishable key. Member JWT when you ship.
          No Sendbird-shaped mobile UI kit.
        </li>
        <li>
          HITL lives in the room (quorum, chain, HMAC from AI SDK 7). That is not a Chat MAU line item on their page.
        </li>
      </ul>
    </MarketingShell>
  );
}
