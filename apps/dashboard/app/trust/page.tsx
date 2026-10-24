import type { Metadata } from "next";
import Link from "next/link";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { buildPageMetadata } from "@/lib/site-metadata";
import { MarketingShell } from "../components/marketing-shell";
import styles from "../landing/landing-c.module.css";

export const metadata: Metadata = buildPageMetadata({
  title: "Trust: FluxyChat hosted",
  description:
    "DPA, subprocessors, security.txt, and status for hosted FluxyChat. Not a SOC 2 report or a HIPAA BAA.",
  path: "/trust",
});

const LEGAL_LINKS = [
  {
    label: "Data processing addendum",
    href: HOSTED_PATHS.dpa,
    note: "You are controller; hosted is processor.",
  },
  {
    label: "Subprocessors",
    href: HOSTED_PATHS.subprocessors,
    note: "Cloudflare, Vercel, Clerk, Stripe, plus any LLM vendor you turn on.",
  },
  {
    label: "Privacy policy and terms",
    href: HOSTED_PATHS.privacyPolicy,
    note: "What we collect, why, and the contract for the hosted service.",
  },
  {
    label: "Status",
    href: HOSTED_PATHS.status,
    note: "Worker /health. It is not a multi-region SLO.",
  },
  {
    label: "security.txt",
    href: "/.well-known/security.txt",
    note: "Use it if you found a hole.",
  },
  {
    label: "Incident rooms",
    href: HOSTED_PATHS.incident,
    note: "Product copy for a war-room scaffold, not our public postmortem feed.",
  },
  {
    label: "Report illegal content",
    href: HOSTED_PATHS.report,
    note: "DSA hosting notice for public share URLs. We are not a very large online platform.",
  },
] as const;

export default function TrustPage() {
  return (
    <MarketingShell className={styles.pageNarrow}>
      <header className={styles.pageHero}>
        <div className={styles.pageHeroCopy}>
          <span className={styles.pageEyebrow}>Trust / hosted beta</span>
          <h1 className={styles.pageTitle}>The honest version.</h1>
          <p className={styles.pageLede}>
            Hosted FluxyChat is open beta. No SLA. No SOC 2 letter, no pen-test PDF, no HIPAA BAA.
            Hosted login does not include SAML. SSO/SCIM is for self-host. A written MSA waits on a
            paying customer.
          </p>
        </div>
        <div className={styles.pageMeta}>
          <span>
            <strong>Hosted</strong> beta
          </span>
          <span>
            <strong>No</strong> SOC 2
          </span>
          <span>
            <strong>No</strong> BAA
          </span>
        </div>
      </header>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Legal and ops</span>
          <h2 className={styles.pageH2}>Documents, not badges.</h2>
        </div>
        <div className={styles.pageBody}>
          <ul>
            {LEGAL_LINKS.map((item) => (
              <li key={item.label}>
                <Link href={item.href}>{item.label}</Link>: {item.note}
              </li>
            ))}
          </ul>
          <p>
            Contact: <a href="mailto:support@fluxychat.com">support@fluxychat.com</a>. Not legal
            advice.
          </p>
        </div>
      </section>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Encryption</span>
          <h2 className={styles.pageH2}>TLS, envelopes, and the limit.</h2>
        </div>
        <div className={styles.pageBody}>
          <p>
            TLS on the wire. Optional room envelopes use a key wrapped by the Worker. Operators who
            can read Worker secrets can unwrap. When <code>invokeAgent</code> runs, the model sees
            plaintext for that turn. This is not customer KMS and not Proton-style zero-access.
          </p>
        </div>
      </section>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>What we do not claim</span>
          <h2 className={styles.pageH2}>The list is short because it matters.</h2>
        </div>
        <div className={styles.pageBody}>
          <ul>
            <li>Not a helpdesk, CRM, or social graph.</li>
            <li>Not end-to-end encrypted. Room envelopes are optional and operator-readable.</li>
            <li>Not a HIPAA service. Health demos are not HIPAA.</li>
            <li>Not a multi-region SLO. Cloudflare PoP and RTT numbers are Cloudflare&apos;s.</li>
            <li>Not a finished omnichannel suite. Bridges require your vendor apps.</li>
          </ul>
        </div>
      </section>

      <div className={styles.pageCta}>
        <div>
          <span className={styles.pageEyebrow}>Next</span>
          <p className={styles.pageH2}>Read the contract before the brochure.</p>
          <p>Start with the DPA and subprocessors. Bring your own review.</p>
        </div>
        <div className={styles.pageActions}>
          <Link href={HOSTED_PATHS.dpa} className={`${styles.btn} ${styles.btnPrimary}`}>
            Read the DPA
          </Link>
          <Link href={HOSTED_PATHS.forTeams} className={`${styles.btn} ${styles.btnGhost}`}>
            For teams
          </Link>
          <Link href="/pricing" className={`${styles.btn} ${styles.btnGhost}`}>
            Pricing
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
