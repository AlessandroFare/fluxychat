import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "../components/marketing-shell";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Terms of service: FluxyChat",
  description: "Hosted FluxyChat terms. Open beta. Pin npm. Self-host is MIT.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <MarketingShell className="max-w-3xl py-12">
      <h1 className="font-heading text-3xl font-bold tracking-tight">Terms of service</h1>
      <p className="mt-3 text-sm text-muted-foreground">Effective 7 September 2026. Hosted FluxyChat only.</p>

      <div className="mt-8 space-y-4 text-sm leading-relaxed">
        <p>
          FluxyChat is a room layer: chat, presence, Yjs, and agents on a Cloudflare Worker. Hosted cloud
          is open beta. Pin npm versions. The MIT Worker in this repo is the self-host product; those
          terms are the license in the repository.
        </p>
        <p>
          You must not use hosted FluxyChat for abuse, illegal content, or to attack the service. You keep
          the rights to your content. You are responsible for end-user notices in your app.
        </p>
        <p>
          Free and paid self-serve plans are usage-capped as shown on{" "}
          <Link className="underline underline-offset-2" href="/pricing">
            /pricing
          </Link>
          . Growth, Business, and Enterprise rows on that page are quotes, not a click-to-buy SLA.
        </p>
        <p>
          We can change the beta, rate-limit, or suspend accounts that break these terms. Data processing
          is in the{" "}
          <Link className="underline underline-offset-2" href={HOSTED_PATHS.dpa}>
            DPA
          </Link>
          . Privacy:{" "}
          <Link className="underline underline-offset-2" href={HOSTED_PATHS.privacyPolicy}>
            /privacy-policy
          </Link>
          .
        </p>
        <p>
          Contact{" "}
          <a className="underline underline-offset-2" href="mailto:fluxychat@outlook.com">
            fluxychat@outlook.com
          </a>
          .
        </p>
      </div>
    </MarketingShell>
  );
}
