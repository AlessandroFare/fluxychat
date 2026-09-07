import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "../components/marketing-shell";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { PRIVACY_UPDATED, RETENTION_DEFAULTS, SUB_PROCESSORS } from "@/lib/privacy-legal-copy";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Privacy policy: FluxyChat",
  description: "What hosted FluxyChat stores. GDPR export lives in the signed-in console.",
  path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
  return (
    <MarketingShell className="max-w-3xl py-12">
      <h1 className="font-heading text-3xl font-bold tracking-tight">Privacy policy</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated {PRIVACY_UPDATED}. Public policy for hosted cloud.</p>

      <div className="mt-8 space-y-4 text-sm leading-relaxed">
        <p>
          You are the controller for chat your users send through your app. We store what the Worker
          needs to run rooms: messages, presence, Yjs documents, attachments if you upload them, and
          account/billing fields. Dashboard login may use Clerk.
        </p>
        <p>
          Export and delete for a signed-in operator: console{" "}
          <Link className="underline underline-offset-2" href="/privacy">
            /privacy
          </Link>{" "}
          (JWT required). DPA:{" "}
          <Link className="underline underline-offset-2" href={HOSTED_PATHS.dpa}>
            /dpa
          </Link>
          . Processors:{" "}
          <Link className="underline underline-offset-2" href={HOSTED_PATHS.subprocessors}>
            /subprocessors
          </Link>
          .
        </p>
      </div>

      <h2 className="mt-10 font-heading text-lg font-semibold">Default retention</h2>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {RETENTION_DEFAULTS.map((row) => (
          <li key={row.label}>
            <span className="font-medium text-foreground">{row.label}.</span> {row.detail}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 font-heading text-lg font-semibold">Processors (summary)</h2>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {SUB_PROCESSORS.map((row) => (
          <li key={row.name}>
            <span className="font-medium text-foreground">{row.name}.</span> {row.role}
          </li>
        ))}
      </ul>
    </MarketingShell>
  );
}
