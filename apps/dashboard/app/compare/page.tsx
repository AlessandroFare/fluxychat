import Link from "next/link";
import {
  ALTERNATIVE_APPROACHES,
  BUILD_VS_BUY,
  BUYING_FAQ,
  COMPARE_ROWS,
  COMPARE_HOSTED_CHAT_HEADER,
  DECISION_FLOW,
  HACKATHON_ROOM_OS_LINKS,
  ABLY_ON_VERCEL,
  DIY_DO_COMPARISON,
  SDK_BUNDLE_BENCHMARKS,
  PRODUCT_CHAT_VS_SUPPORT,
  PUSHER_BILL_SHOCK,
  PUSHER_ON_VERCEL,
  SELF_HOST_POSITIONING,
} from "@/lib/compare-providers";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";
import { Button } from "~/components/ui/button";
import { MarketingShell } from "../components/marketing-shell";
import { CloudflareCostTable } from "~/components/marketing/cloudflare-cost-table";
import { DEVTO_SOCKET_FLEET_ARTICLE } from "@/lib/marketing-links";
import { HOSTED_PATHS } from "@/lib/hosted-product";

export const metadata = buildPageMetadata({
  title: "Compare FluxyChat vs Pusher, Ably, Stream, hosted chat SDKs",
  description:
    "How FluxyChat compares to Stream, Ably, Pusher, and DIY Workers. Room layer on Cloudflare: chat, presence, Yjs, agents, HTTP ingest. MIT self-host or hosted beta.",
  path: "/compare",
});

function CompareTable({
  headers,
  rows,
}: {
  headers: readonly string[];
  rows: readonly { cells: readonly string[] }[];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {headers.map((header) => (
              <th
                key={header}
                className="px-4 py-3 font-semibold first:font-semibold [&:not(:first-child)]:font-medium [&:not(:first-child)]:text-muted-foreground last:text-primary"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.cells[0]}
              className="border-b border-border last:border-0"
            >
              {row.cells.map((cell, cellIndex) => (
                <td
                  key={`${row.cells[0]}-${cellIndex}`}
                  className={
                    cellIndex === 0
                      ? "px-4 py-3 font-medium"
                      : cellIndex === row.cells.length - 1
                        ? "px-4 py-3 font-medium"
                        : "px-4 py-3 text-muted-foreground"
                  }
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ComparePage() {
  return (
    <MarketingShell className="py-16 sm:py-16">
      <p className="text-sm text-muted-foreground">
        <Link href={HOSTED_PATHS.landing} className="text-brand underline underline-offset-2">
          ← Back to landing
        </Link>
      </p>
      <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
        Compare FluxyChat
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Put a room in the product and you are done shopping for a stack. Chat, presence, Yjs, and an agent on the same Durable Object. Guest widget on a public room takes minutes. Member JWT when you ship. MIT on your Cloudflare account when procurement asks who owns the data.
        Spec lives at{" "}
        <a href="https://docs.fluxychat.com" className="text-brand underline underline-offset-2">
          docs.fluxychat.com
        </a>
        . Ably and Pusher are transport. Liveblocks is the document. Stream is consumer chat. Voice media is LiveKit. IoT is HTTP ingest.{" "}
        <Link href={MARKETING_GUIDE_PATHS.pusherAlternativeSaas} className="text-brand underline underline-offset-2">
          Pusher alternative guide
        </Link>
      </p>

      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 text-sm">
        <p className="font-medium">{PUSHER_BILL_SHOCK.title}</p>
        <p className="mt-1 text-muted-foreground">{PUSHER_BILL_SHOCK.intro}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
          {PUSHER_BILL_SHOCK.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-4 text-sm">
        <p className="font-medium">{SELF_HOST_POSITIONING.title}</p>
        <p className="mt-1 text-muted-foreground">{SELF_HOST_POSITIONING.intro}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
          {SELF_HOST_POSITIONING.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-4 text-sm">
        <p className="font-medium">{PRODUCT_CHAT_VS_SUPPORT.title}</p>
        <p className="mt-1 text-muted-foreground">{PRODUCT_CHAT_VS_SUPPORT.intro}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
          {PRODUCT_CHAT_VS_SUPPORT.bullets.map((item) => (
            <li key={item.slice(0, 40)}>{item}</li>
          ))}
        </ul>
        <p className="mt-3">
          <Link
            href={MARKETING_GUIDE_PATHS.inAppChatVsSupportDesk}
            className="font-medium text-brand underline underline-offset-2"
          >
            Product chat vs support desk guide
          </Link>
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 text-sm">
        <p className="font-medium">Walkthrough on Dev.to</p>
        <p className="mt-1 text-muted-foreground">
          Architecture, RoomDurableObject, SDK reconnect, and self-host steps {" "}
          <a
            href={DEVTO_SOCKET_FLEET_ARTICLE.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand underline underline-offset-2"
          >
            {DEVTO_SOCKET_FLEET_ARTICLE.title}
          </a>
          .
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-muted/30 px-4 py-4 text-sm">
        <p className="font-medium">One platform, not a patchwork of SKUs</p>
        <p className="mt-1 text-muted-foreground">
          Pusher and Ably excel at pub/sub channels. Stream bundles chat and feeds with separate video products.
          FluxyChat ships stream, collab, game, IoT, fleet, and spatial modules on the same Worker and room kernel,
          so you are not stitching five vendor bills for one product experience.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-muted/30 px-4 py-4 text-sm">
        <p className="font-medium">Chat layer, not full BaaS</p>
        <p className="mt-1 text-muted-foreground">
          If you need auth, RBAC, uploads, and AI in one mega-starter, a full Cloudflare
          framework may fit. If the product is tenant-scoped in-app messaging with history
          and operator tools, FluxyChat is the slice.{" "}
          <Link href="/why#not" className="text-brand underline underline-offset-2">
            What we are not
          </Link>
        </p>
      </div>

      <h2 className="mt-16 font-heading text-xl font-bold sm:text-2xl">
        {BUILD_VS_BUY.title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{BUILD_VS_BUY.intro}</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        {BUILD_VS_BUY.bullets.map((item) => (
          <li key={item.slice(0, 48)}>{item}</li>
        ))}
      </ul>

      <h2 className="mt-16 font-heading text-xl font-bold sm:text-2xl">
        Managed chat APIs
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Side-by-side with proprietary hosted chat SDKs, Stream, Ably, and Pusher.
        Rows are factual. Check each vendor&apos;s current docs before you buy.
      </p>
      <div className="mt-4">
        <CompareTable
          headers={[
            "Capability",
            COMPARE_HOSTED_CHAT_HEADER,
            "Stream",
            "Ably",
            "Pusher",
            "FluxyChat",
          ]}
          rows={COMPARE_ROWS.map((row) => ({
            cells: [row.label, row.portal, row.stream, row.ably, row.pusher, row.fluxy],
          }))}
        />
      </div>

      <h2 className="mt-16 font-heading text-xl font-bold sm:text-2xl">
        SDK bundle size
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Gzip sizes from CI (<code className="text-xs">pnpm run check:bundle-size</code>).
        App bundles tree-shake imports, so chat-only paths stay small. See the{" "}
        <Link href="/docs/guides/feature-parity-checklist" className="text-brand underline underline-offset-2">
          feature parity checklist
        </Link>
        .
      </p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[480px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 font-medium">Package</th>
              <th className="px-4 py-3 font-medium">Gzip</th>
              <th className="px-4 py-3 font-medium">Budget</th>
              <th className="px-4 py-3 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {SDK_BUNDLE_BENCHMARKS.map((row) => (
              <tr key={row.package} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{row.package}</td>
                <td className="px-4 py-3">{row.gzipKb} kB</td>
                <td className="px-4 py-3">{row.budgetKb != null ? `${row.budgetKb} kB` : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-16 font-heading text-xl font-bold sm:text-2xl">
        Platform readiness
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Each product and vertical on the docs site shows a production, beta, or preview badge. Check the{" "}
        <Link href="https://docs.fluxychat.com/docs/platform" className="text-brand underline underline-offset-2">
          platform overview
        </Link>{" "}
        before you plan a launch around stream, voice, collab, or mobile SDKs.
      </p>

      <h2 className="mt-16 font-heading text-xl font-bold sm:text-2xl">
        {ABLY_ON_VERCEL.title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {ABLY_ON_VERCEL.intro}{" "}
        <Link
          href={MARKETING_GUIDE_PATHS.nextjsVercelRealtimeChat}
          className="text-brand underline underline-offset-2"
        >
          Next.js on Vercel guide
        </Link>
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        {ABLY_ON_VERCEL.bullets.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 className="mt-16 font-heading text-xl font-bold sm:text-2xl">
        {PUSHER_ON_VERCEL.title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {PUSHER_ON_VERCEL.intro}{" "}
        <Link
          href={MARKETING_GUIDE_PATHS.vercelRealtimeWithoutPusher}
          className="text-brand underline underline-offset-2"
        >
          Full Vercel guide
        </Link>
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
        {PUSHER_ON_VERCEL.bullets.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 className="mt-16 font-heading text-xl font-bold sm:text-2xl">
        FluxyChat vs DIY Durable Objects chat
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        GitHub examples are excellent teachers; production SaaS usually needs the rows below.{" "}
        <Link
          href={MARKETING_GUIDE_PATHS.reconnectDurableObjectsHibernation}
          className="text-brand underline underline-offset-2"
        >
          Reconnect and hibernation guide
        </Link>
      </p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 font-semibold">Concern</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                DIY DO repo
              </th>
              <th className="px-4 py-3 font-semibold text-primary">FluxyChat</th>
            </tr>
          </thead>
          <tbody>
            {DIY_DO_COMPARISON.map((row) => (
              <tr
                key={row.concern}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3 font-medium">{row.concern}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.diy}</td>
                <td className="px-4 py-3 font-medium">{row.fluxy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-muted/30 px-4 py-4 text-sm">
        <p className="font-medium">PartyKit vs FluxyChat (SaaS chat)</p>
        <p className="mt-1 text-muted-foreground">
          PartyKit wins collab parties and generic edge realtime. FluxyChat wins when you ship
          tenant-scoped in-app messaging with history, JWT, and operator tooling. See the PartyKit
          row in the table below.
        </p>
      </div>

      <h2 className="mt-16 font-heading text-xl font-bold sm:text-2xl">
        Running costs on Cloudflare
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Both options ship the same Worker. The Free tier is generous for early
        apps; the Paid tier scales with usage; self-hosting is just your own
        Cloudflare bill.
      </p>
      <div className="mt-6">
        <CloudflareCostTable variant="light" />
      </div>

      <h2 className="mt-16 font-heading text-xl font-bold sm:text-2xl">
        Other approaches on Cloudflare
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Common mental models from Reddit and CF threads: when to use something else vs
        FluxyChat.
      </p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 font-semibold">Approach</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                Best for
              </th>
              <th className="px-4 py-3 font-medium text-muted-foreground">
                Tradeoff
              </th>
              <th className="px-4 py-3 font-semibold text-primary">
                FluxyChat angle
              </th>
            </tr>
          </thead>
          <tbody>
            {ALTERNATIVE_APPROACHES.map((row) => (
              <tr
                key={row.name}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.bestFor}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.tradeoff}
                </td>
                <td className="px-4 py-3 font-medium">{row.fluxyAngle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-16 font-heading text-xl font-bold sm:text-2xl">
        Questions we hear before buying
      </h2>
      <dl className="mt-6 space-y-4">
        {BUYING_FAQ.map((item) => (
          <div
            key={item.q}
            className="rounded-xl border border-border p-4"
          >
            <dt className="font-semibold">{item.q}</dt>
            <dd className="mt-2 text-sm text-muted-foreground">{item.a}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-muted-foreground">
        Cost guardrails, operator console, and DO capacity:{" "}
        <Link href="/why#cost" className="text-brand underline underline-offset-2">
          /why: cost & architecture
        </Link>
      </p>

      <h2 id="room-os" className="mt-16 font-heading text-xl font-bold sm:text-2xl">
        Room OS for humans + agents
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Patterns from real hackathon builds: external agents join rooms, negotiate across orgs,
        and react to live signals. Not a chat widget SKU.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {HACKATHON_ROOM_OS_LINKS.map((item) => (
          <li key={item.id} className="rounded-xl border border-border p-4 text-sm">
            <span className="text-xs font-medium text-muted-foreground">{item.id}</span>
            <p className="mt-1 font-semibold">{item.label}</p>
            <p className="mt-2 flex flex-wrap gap-3 text-xs">
              <a href={item.href} className="text-brand underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                Docs
              </a>
              <Link href={item.console} className="text-brand underline underline-offset-2">
                Console
              </Link>
            </p>
          </li>
        ))}
      </ul>

      <h2 className="mt-16 font-heading text-2xl font-bold">Decision flow</h2>
      <ol className="mt-6 space-y-6">
        {DECISION_FLOW.map((item, index) => (
          <li key={item.question} className="rounded-xl border border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">
              Step {index + 1}
            </p>
            <p className="mt-1 font-semibold">{item.question}</p>
            <p className="mt-2 text-sm text-muted-foreground">{item.yes}</p>
            {"no" in item && item.no ? (
              <p className="mt-1 text-sm text-foreground">{item.no}</p>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="mt-12 flex flex-wrap gap-3">
        <Button asChild>
          <Link href={HOSTED_PATHS.getStarted}>Get started</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/demo">Try demo room</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/why">Why FluxyChat</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/guides">All guides</Link>
        </Button>
        <Button asChild variant="outline">
          <a href={DEVTO_SOCKET_FLEET_ARTICLE.href} target="_blank" rel="noopener noreferrer">
            Dev.to article
          </a>
        </Button>
      </div>
    </MarketingShell>
  );
}

