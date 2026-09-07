import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "../components/marketing-shell";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Data processing addendum: FluxyChat",
  description: "Standard DPA for hosted FluxyChat. Customer is controller. FluxyChat is processor.",
  path: "/dpa",
});

export default function DpaPage() {
  return (
    <MarketingShell className="max-w-3xl py-12">
      <h1 className="font-heading text-3xl font-bold tracking-tight">Data processing addendum</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Effective 7 September 2026. This is the standard DPA for hosted FluxyChat. Print or save this page.
        A signed PDF with custom clauses is only with a written MSA. Hosted is open beta. Self-host if you
        need the Worker in your Cloudflare account with no Clerk or Stripe.
      </p>

      <ol className="mt-8 list-decimal space-y-4 pl-5 text-sm leading-relaxed">
        <li>
          <strong>Roles.</strong> You (the customer) are the controller of end-user chat, presence, and room
          documents. FluxyChat is the processor for hosted cloud. If you self-host, you are both controller
          and operator; this DPA does not apply to your Cloudflare account.
        </li>
        <li>
          <strong>Subject matter.</strong> We process message bodies, room ids, user ids you send, presence
          and Yjs updates, files you upload to R2, and billing/account data needed to run the service.
        </li>
        <li>
          <strong>Instructions.</strong> We process that data to provide the Worker APIs, dashboard, and
          related support. We do not sell it. We do not use it to train public models.
        </li>
        <li>
          <strong>Subprocessors.</strong> Listed at{" "}
          <Link className="underline underline-offset-2" href={HOSTED_PATHS.subprocessors}>
            /subprocessors
          </Link>
          . LLM providers only run if you configure in-room agents.
        </li>
        <li>
          <strong>Security.</strong> TLS in transit. Access to hosted production is limited to operators who
          need it. Report issues via{" "}
          <a className="underline underline-offset-2" href="/.well-known/security.txt">
            security.txt
          </a>
          . This is not a SOC 2 report.
        </li>
        <li>
          <strong>Assistance.</strong> GDPR export and erasure: console Privacy tools, or Worker{" "}
          <code>GET /gdpr/export</code> and related delete routes, with a member or admin JWT.
        </li>
        <li>
          <strong>Retention.</strong> Defaults are on the privacy policy. You can shorten retention in
          project settings where the Worker supports it.
        </li>
        <li>
          <strong>International transfers.</strong> Cloudflare and Vercel may process outside the EEA. Their
          terms apply to those transfers.
        </li>
        <li>
          <strong>Term.</strong> This DPA lasts while you use hosted FluxyChat. After deletion or account
          close, we delete or anonymize remaining copies on the schedule in the privacy policy, except
          where law requires a longer hold.
        </li>
        <li>
          <strong>Liability.</strong> Hosted is open beta. Liability is as in the{" "}
          <Link className="underline underline-offset-2" href={HOSTED_PATHS.terms}>
            terms
          </Link>
          . Written SLA only in a signed MSA.
        </li>
      </ol>

      <p className="mt-8 text-sm text-muted-foreground">
        Questions:{" "}
        <a className="underline underline-offset-2" href="mailto:fluxychat@outlook.com">
          fluxychat@outlook.com
        </a>
        . Privacy policy:{" "}
        <Link className="underline underline-offset-2" href={HOSTED_PATHS.privacyPolicy}>
          /privacy-policy
        </Link>
        .
      </p>
    </MarketingShell>
  );
}
