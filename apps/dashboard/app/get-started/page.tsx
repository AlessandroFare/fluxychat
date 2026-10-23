import type { Metadata } from "next";
import Link from "next/link";
import { PAGE_METADATA } from "@/lib/marketing-copy";
import { Cloud, Code2, KeyRound, LayoutDashboard, Package } from "lucide-react";
import { GetStartedAuthCta } from "../components/get-started-auth-cta";
import { GetStartedSelfHostSection } from "../components/get-started-self-host";
import { MarketingShell } from "../components/marketing-shell";
import { QuickstartSdkSnippet } from "../components/quickstart-sdk-snippet";
import { HOSTED_COPY, HOSTED_PATHS, docsSiteHref } from "@/lib/hosted-product";
import styles from "../landing/landing-c.module.css";

export const metadata: Metadata = PAGE_METADATA.getStarted;

const HOSTED_STEPS = [
  {
    icon: Package,
    title: "Public room with pk_",
    body: "npx @fluxy-chat/create-fluxy-chat@latest my-room --example shared-ai-room. Guest join, two tabs. Console signup is later, for ops.",
  },
  {
    icon: Code2,
    title: "Or install the SDK in your app",
    body: "pnpm add @fluxy-chat/react. FluxyRealtimeProvider plus publishableKey (pk_). No token endpoint on public rooms.",
  },
  {
    icon: Cloud,
    title: "Self-host the Worker when you need it",
    body: "wrangler deploy on your Cloudflare account. Hosted cloud is beta if you want us to run the Worker.",
  },
  {
    icon: LayoutDashboard,
    title: "Console for agents, quotas, billing",
    body: "Sign in when you need JWT minting, agents, or invoices. Not required to try a public room.",
  },
  {
    icon: KeyRound,
    title: "Member JWT for private rooms",
    body: "POST /auth/token with X-Fluxy-Api-Key (fc_ stays on the server). pk_ cannot mint member tokens.",
  },
] as const;

export default function GetStartedPage() {
  return (
    <MarketingShell className={styles.pageWide}>
      <header className={styles.pageHero}>
        <div className={styles.pageHeroCopy}>
          <span className={styles.pageEyebrow}>Quickstart / first message</span>
          <h1 className={styles.pageTitle}>Get your first message live.</h1>
          <p className={styles.pageLede}>
            Start with a public room and a publishable key. Add the console when you need member
            JWTs, agents, or invoices. Self-hosting is optional, and the hosted beta does not
            pretend to be an enterprise contract.
          </p>
          <div className={styles.pageActions}>
            <GetStartedAuthCta />
            <Link href={HOSTED_PATHS.docs} className={`${styles.btn} ${styles.btnGhost}`}>
              {HOSTED_COPY.viewDocs}
            </Link>
          </div>
        </div>
        <div className={styles.pageMeta}>
          <span>
            <strong>pk_</strong> public rooms
          </span>
          <span>
            <strong>fc_</strong> server only
          </span>
          <span>
            <strong>MIT</strong> self-host
          </span>
        </div>
      </header>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Fastest path</span>
          <h2 className={styles.pageH2}>Chat in two commands.</h2>
        </div>
        <div className={styles.pageBody}>
          <p>
            Scaffold a chat-only Vite app, or install the React SDK into the app you already have.
            A public room needs a <code>publishableKey</code>; private rooms need a member JWT
            minted on your server.
          </p>
          <QuickstartSdkSnippet />

          <div className={styles.pageCard}>
            <span className={styles.pageEyebrow}>Chat only</span>
            <h3>Minimal CLI or drop-in widget</h3>
            <p>
              Public rooms use <code>publishableKey</code> on the provider, or{" "}
              <code>guest</code> on <code>FluxyChatWidget</code>. No card. Free hosted is beta.
              For headless control, use <code>useChat</code>.
            </p>
            <pre>
              <code>{`npx @fluxy-chat/create-fluxy-chat@latest my-chat --minimal\npnpm add @fluxy-chat/ui-kit`}</code>
            </pre>
            <div className={styles.pageActions}>
              <Link
                href={HOSTED_PATHS.onboarding}
                className={`${styles.btn} ${styles.btnPrimary}`}
              >
                Open onboarding wizard
              </Link>
              <a
                href={docsSiteHref("getting-started/chat-only-quickstart")}
                className={`${styles.btn} ${styles.btnGhost}`}
              >
                Chat-only quickstart
              </a>
              <a
                href="https://github.com/AlessandroFare/fluxychat/tree/main/packages/ui-kit#readme"
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.btn} ${styles.btnGhost}`}
              >
                ui-kit README
              </a>
            </div>
          </div>

          <p>
            Step-by-step afternoon guide in the repo:{" "}
            <a
              href="https://github.com/AlessandroFare/fluxychat/blob/main/docs/quickstart-afternoon.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              docs/quickstart-afternoon.md
            </a>
            .
          </p>
        </div>
      </section>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Hosted steps</span>
          <h2 className={styles.pageH2}>Five moves, one room.</h2>
        </div>
        <div className={styles.pageBody}>
          <div className={styles.pageCards}>
            {HOSTED_STEPS.map((step, index) => (
              <div key={step.title} className={styles.pageCard}>
                <span className={styles.pageEyebrow}>Step {String(index + 1).padStart(2, "0")}</span>
                <step.icon className={styles.pageIcon} aria-hidden />
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <GetStartedSelfHostSection />

      <div className={styles.pageCta}>
        <div>
          <span className={styles.pageEyebrow}>Next</span>
          <p className={styles.pageH2}>Read the contract, then build.</p>
          <p>
            Hosted is beta. Pin the SDK versions and run your own load review before production.
            For procurement, start with the legal pages, not a badge.
          </p>
        </div>
        <div className={styles.pageActions}>
          <Link href="/for-teams" className={`${styles.btn} ${styles.btnPrimary}`}>
            For teams
          </Link>
          <Link href="/trust" className={`${styles.btn} ${styles.btnGhost}`}>
            Trust
          </Link>
          <Link href={HOSTED_PATHS.landing} className={`${styles.btn} ${styles.btnGhost}`}>
            Product overview
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
