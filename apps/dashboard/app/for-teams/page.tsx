import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "../components/marketing-shell";
import { HOSTED_PATHS, docsSiteHref } from "@/lib/hosted-product";
import { buildPageMetadata } from "@/lib/site-metadata";
import styles from "../landing/landing-c.module.css";

export const metadata: Metadata = buildPageMetadata({
  title: "Ship FluxyChat in a SaaS",
  description: "Checklist for a startup or company putting rooms in the product. Not an enterprise MSA.",
  path: "/for-teams",
});

const KERNEL = [
  "Public room: FluxyRealtimeProvider + publishableKey (pk_) + useChat({ roomId }). Two tabs.",
  "Private room: mint a member JWT with POST /auth/token and X-Fluxy-Api-Key. fc_ stays on your server.",
  "Pin npm: @fluxy-chat/sdk ^0.6.13, @fluxy-chat/react ^0.1.8. Scaffold with npx @fluxy-chat/create-fluxy-chat@latest.",
  "Same room WebSocket for chat, presence, polls, and server_event. Yjs is a second binary socket on the same room.",
];

const BRING = [
  "Live video / huddle media: LiveKit or another SFU. FluxyChat is stage signaling only.",
  "WHIP / HLS ingest: Cloudflare Stream secrets on the Worker. Chat overlay does not need that.",
  "Bridges: you create the Slack/Discord/Telegram app. We store the binding.",
  "Wallet rooms: Worker GET/POST /auth/wallet with fc_ (SIWE + personal_sign). Token gates (NFT/balance) stay on your server.",
];

const COMPANY = [
  { href: "/terms", label: "Terms" },
  { href: "/dpa", label: "DPA" },
  { href: "/privacy-policy", label: "Privacy policy" },
  { href: "/subprocessors", label: "Subprocessors" },
  { href: "/status", label: "Status (Worker /health)" },
  { href: "/trust", label: "Trust (published docs only, not SOC 2)" },
  { href: "/migrate-chatgpt", label: "Import ChatGPT JSON" },
  { href: "/pricing", label: "Pricing (self-serve Free / Starter / Pro)" },
];

export default function ForTeamsPage() {
  return (
    <MarketingShell className={styles.pageNarrow}>
      <header className={styles.pageHero}>
        <div className={styles.pageHeroCopy}>
          <span className={styles.pageEyebrow}>For teams / hosted beta</span>
          <h1 className={styles.pageTitle}>Ship this in a product.</h1>
          <p className={styles.pageLede}>
            For a startup that owns the app. Hosted is open beta: pin versions, no public SLA.
            Self-host MIT if legal wants the Worker in your Cloudflare account. There is no SOC 2
            pack, no HIPAA BAA, and no 99.999% SLO on this page.
          </p>
          <div className={styles.pageActions}>
            <Link href={HOSTED_PATHS.getStarted} className={`${styles.btn} ${styles.btnPrimary}`}>
              Get started
            </Link>
            <a href={docsSiteHref("getting-started/quickstart")} className={`${styles.btn} ${styles.btnGhost}`}>
              Quickstart docs
            </a>
          </div>
        </div>
        <div className={styles.pageMeta}>
          <span>
            <strong>Bring</strong> your app
          </span>
          <span>
            <strong>Keep</strong> your auth
          </span>
          <span>
            <strong>Self-host</strong> MIT
          </span>
        </div>
      </header>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>What we ship</span>
          <h2 className={styles.pageH2}>Kernel, not a platform team.</h2>
        </div>
        <div className={styles.pageBody}>
          <ul>
            {KERNEL.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>You bring these</span>
          <h2 className={styles.pageH2}>The parts that are yours.</h2>
        </div>
        <div className={styles.pageBody}>
          <ul>
            {BRING.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Legal and ops</span>
          <h2 className={styles.pageH2}>Read the hosted contract.</h2>
        </div>
        <div className={styles.pageBody}>
          <ul>
            {COMPANY.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className={styles.pageCta}>
        <div>
          <span className={styles.pageEyebrow}>Onboarding</span>
          <p className={styles.pageH2}>Create a project, copy the key.</p>
          <p>
            The console wizard gets you to a public room. Move the key server-side when you add
            member tokens.
          </p>
        </div>
        <div className={styles.pageActions}>
          <Link href={HOSTED_PATHS.onboarding} className={`${styles.btn} ${styles.btnPrimary}`}>
            Console onboarding
          </Link>
          <Link href="/pricing" className={`${styles.btn} ${styles.btnGhost}`}>
            Pricing
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
