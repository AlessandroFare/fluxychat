import Link from "next/link";
import { COMPARE_ROWS, DECISION_FLOW } from "@/lib/compare-providers";
import { buildPageMetadata } from "@/lib/site-metadata";
import { Button } from "~/components/ui/button";
import { HOSTED_PATHS } from "@/lib/hosted-product";

export const metadata = buildPageMetadata({
  title: "Compare FluxyChat",
  description:
    "How FluxyChat compares to stream APIs, Ably-style realtime, and Pusher-style channels for in-app chat on Cloudflare.",
  path: "/compare",
});

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="text-sm text-muted-foreground">
        <Link href="/landing" className="text-brand hover:underline">
          ← Back to landing
        </Link>
      </p>
      <h1 className="mt-4 font-heading text-4xl font-bold tracking-tight">
        Compare FluxyChat
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Positioning for in-app chat on Cloudflare — not a shootout. FluxyChat is not a
        replacement for SMS/WhatsApp providers; pair with them when you need both channels.
      </p>

      <div className="mt-10 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 font-semibold">Capability</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Stream APIs</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Ably-style</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Pusher-style</th>
              <th className="px-4 py-3 font-semibold text-primary">FluxyChat</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{row.label}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.stream}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.ably}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.pusher}</td>
                <td className="px-4 py-3 font-medium">{row.fluxy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-16 font-heading text-2xl font-bold">Decision flow</h2>
      <ol className="mt-6 space-y-6">
        {DECISION_FLOW.map((item, index) => (
          <li key={item.question} className="rounded-xl border border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">Step {index + 1}</p>
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
      </div>
    </div>
  );
}
