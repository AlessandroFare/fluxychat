import Link from "next/link";
import {
  ALTERNATIVE_APPROACHES,
  BUYING_FAQ,
  COMPARE_ROWS,
  DECISION_FLOW,
  ABLY_ON_VERCEL,
  DIY_DO_COMPARISON,
  PUSHER_ON_VERCEL,
} from "@/lib/compare-providers";
import { MARKETING_GUIDE_PATHS } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";
import { Button } from "~/components/ui/button";
import { DEVTO_SOCKET_FLEET_ARTICLE } from "@/lib/marketing-links";
import { HOSTED_PATHS } from "@/lib/hosted-product";

export const metadata = buildPageMetadata({
  title: "Compare FluxyChat",
  description:
    "FluxyChat vs Stream, Ably, Pusher, Vercel WebSocket workarounds, and DIY edge chat — room-per-DO on Cloudflare, Pusher alternative without a VPS.",
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
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/landing" className="text-brand hover:underline">
          ← Back to landing
        </Link>
      </p>
      <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
        Compare FluxyChat
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Rough positioning for teams evaluating Stream, Ably, Pusher, PartyKit, or
        DIY Workers stacks — not a feature shootout. FluxyChat is a{" "}
        <strong className="font-medium text-foreground">chat layer only</strong> on
        Cloudflare (one Durable Object per room + D1), MIT self-host, or hosted beta.
        Not SMS/WhatsApp; pair telco APIs when you need both.{" "}
        <Link href={HOSTED_PATHS.guidesCloudflareChat} className="text-brand hover:underline">
          Cloudflare Workers chat guide
        </Link>
        .
      </p>

      <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 text-sm">
        <p className="font-medium">Walkthrough on Dev.to</p>
        <p className="mt-1 text-muted-foreground">
          Architecture, RoomDurableObject, SDK reconnect, and self-host steps —{" "}
          <a
            href={DEVTO_SOCKET_FLEET_ARTICLE.href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand hover:underline"
          >
            {DEVTO_SOCKET_FLEET_ARTICLE.title}
          </a>
          .
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-muted/30 px-4 py-4 text-sm">
        <p className="font-medium">Chat layer, not full BaaS</p>
        <p className="mt-1 text-muted-foreground">
          If you need auth, RBAC, uploads, and AI in one mega-starter, a full Cloudflare
          framework may fit. If the product is tenant-scoped in-app messaging with history
          and operator tools, FluxyChat is the slice.{" "}
          <Link href="/why#not" className="text-brand hover:underline">
            What we are not →
          </Link>
        </p>
      </div>

      <h2 className="mt-12 font-heading text-xl font-bold sm:text-2xl">
        Managed chat APIs
      </h2>
      <div className="mt-4">
        <CompareTable
          headers={[
            "Capability",
            "Stream APIs",
            "Ably-style",
            "Pusher-style",
            "FluxyChat",
          ]}
          rows={COMPARE_ROWS.map((row) => ({
            cells: [row.label, row.stream, row.ably, row.pusher, row.fluxy],
          }))}
        />
      </div>

      <h2 className="mt-16 font-heading text-xl font-bold sm:text-2xl">
        {ABLY_ON_VERCEL.title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        {ABLY_ON_VERCEL.intro}{" "}
        <Link
          href={MARKETING_GUIDE_PATHS.nextjsVercelRealtimeChat}
          className="text-brand hover:underline"
        >
          Next.js on Vercel guide →
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
          className="text-brand hover:underline"
        >
          Full Vercel guide →
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
          className="text-brand hover:underline"
        >
          Reconnect & hibernation guide →
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
          tenant-scoped in-app messaging with history, JWT, and operator tooling — see the PartyKit
          row in the table below.
        </p>
      </div>

      <h2 className="mt-16 font-heading text-xl font-bold sm:text-2xl">
        Other approaches on Cloudflare
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Common mental models from Reddit and CF threads — when to use something else vs
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
        <Link href="/why#cost" className="text-brand hover:underline">
          /why — cost & architecture
        </Link>
      </p>

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
          <a href={DEVTO_SOCKET_FLEET_ARTICLE.href} target="_blank" rel="noreferrer">
            Dev.to article
          </a>
        </Button>
      </div>
    </div>
  );
}
