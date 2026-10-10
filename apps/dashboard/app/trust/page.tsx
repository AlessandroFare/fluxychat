import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "../components/marketing-shell";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Trust: FluxyChat hosted",
  description:
    "DPA, subprocessors, security.txt, and status for hosted FluxyChat. Not a SOC 2 report or a HIPAA BAA.",
  path: "/trust",
});

export default function TrustPage() {
  return (
    <MarketingShell className="max-w-3xl py-12">
      <h1 className="font-heading text-3xl font-bold tracking-tight">Trust</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Hosted FluxyChat is open beta. No SLA. No SOC 2 letter, no pen-test PDF, no HIPAA BAA.
        Hosted login does not include SAML. SSO/SCIM is for self-host. A written MSA waits on a
        paying customer.
      </p>

      <h2 className="mt-10 font-heading text-lg font-semibold">Legal and ops</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
        <li>
          <Link className="underline underline-offset-2" href={HOSTED_PATHS.dpa}>
            Data processing addendum
          </Link>
          . You are controller; hosted is processor.
        </li>
        <li>
          <Link className="underline underline-offset-2" href={HOSTED_PATHS.subprocessors}>
            Subprocessors
          </Link>
          : Cloudflare, Vercel, Clerk, Stripe, plus any LLM vendor you turn on.
        </li>
        <li>
          <Link className="underline underline-offset-2" href={HOSTED_PATHS.privacyPolicy}>
            Privacy policy
          </Link>
          {" · "}
          <Link className="underline underline-offset-2" href={HOSTED_PATHS.terms}>
            Terms
          </Link>
        </li>
        <li>
          <Link className="underline underline-offset-2" href={HOSTED_PATHS.status}>
            Status
          </Link>
          {" "}
          is Worker <code>/health</code>. It is not a multi-region SLO.
        </li>
        <li>
          <a className="underline underline-offset-2" href="/.well-known/security.txt">
            security.txt
          </a>
          {" "}
          if you found a hole.
        </li>
        <li>
          <Link className="underline underline-offset-2" href={HOSTED_PATHS.incident}>
            Incident rooms
          </Link>
          {" "}
          is product copy for a war-room scaffold. It is not our public postmortem feed.
        </li>
        <li>
          <Link className="underline underline-offset-2" href={HOSTED_PATHS.report}>
            Report illegal content
          </Link>
          {" "}
          is a DSA hosting notice for public share URLs. We are not a very large online platform.
          Contact: support@fluxychat.com. Not legal advice.
        </li>
      </ul>

      <h2 className="mt-10 font-heading text-lg font-semibold">Encryption</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        TLS on the wire. Optional room envelopes use a key wrapped by the Worker. Operators who can
        read Worker secrets can unwrap. When <code>invokeAgent</code> runs, the model sees plaintext
        for that turn. This is not customer KMS and not Proton-style zero-access.
      </p>

      <p className="mt-10 text-sm">
        <Link className="font-medium underline underline-offset-2" href={HOSTED_PATHS.forTeams}>
          For teams
        </Link>
        {" · "}
        <Link className="font-medium underline underline-offset-2" href="/pricing">
          Pricing
        </Link>
      </p>
    </MarketingShell>
  );
}
