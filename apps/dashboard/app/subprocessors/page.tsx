import type { Metadata } from "next";
import { MarketingShell } from "../components/marketing-shell";
import { SUB_PROCESSORS } from "@/lib/privacy-legal-copy";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Subprocessors: FluxyChat",
  description: "Processors that may handle data when you use hosted FluxyChat.",
  path: "/subprocessors",
});

export default function SubprocessorsPage() {
  return (
    <MarketingShell className="max-w-3xl py-12">
      <h1 className="font-heading text-3xl font-bold tracking-tight">Subprocessors</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Hosted FluxyChat may use the processors below. Self-host in your Cloudflare account if you
        do not want Clerk, Stripe, or our LLM path. This is not a DPA. A downloadable DPA is a later
        legal deliverable.
      </p>
      <ul className="mt-8 space-y-4">
        {SUB_PROCESSORS.map((row) => (
          <li key={row.name} className="rounded-xl border border-border bg-card p-4">
            <p className="font-medium">{row.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{row.role}</p>
          </li>
        ))}
        <li className="rounded-xl border border-border bg-card p-4">
          <p className="font-medium">Vercel</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hosts the marketing site and console (Next.js).
          </p>
        </li>
      </ul>
      <p className="mt-8 text-xs text-muted-foreground">
        Security contact: see{" "}
        <a className="underline underline-offset-2" href="/.well-known/security.txt">
          security.txt
        </a>
        .
      </p>
    </MarketingShell>
  );
}
