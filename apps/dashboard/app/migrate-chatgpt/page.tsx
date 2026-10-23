import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "../components/marketing-shell";
import { HOSTED_PATHS, docsSiteHref } from "@/lib/hosted-product";
import { buildPageMetadata } from "@/lib/site-metadata";
import styles from "../landing/landing-c.module.css";

export const metadata: Metadata = buildPageMetadata({
  title: "Import a ChatGPT export",
  description:
    "Drop a conversations.json you already downloaded into a FluxyChat room. Not a live OpenAI sync.",
  path: "/migrate-chatgpt",
});

const STEPS = [
  "One shot. First non-empty ChatGPT conversation in the file, cap 400 messages.",
  "Claude dumps with chat_messages use the same route.",
  "In the console: Rooms, then Import ChatGPT/Claude JSON. Over HTTP: POST /rooms/import-transcript with a member JWT.",
];

const SKIPS = [
  "We are not trying to replace ChatGPT.",
  "No live pull from OpenAI. We do not scrape your account.",
  "No email invites. Pass FluxyChat user ids only if those people already exist.",
];

export default function MigrateChatgptPage() {
  return (
    <MarketingShell className={styles.pageNarrow}>
      <header className={styles.pageHero}>
        <div className={styles.pageHeroCopy}>
          <span className={styles.pageEyebrow}>Import / one shot</span>
          <h1 className={styles.pageTitle}>Bring the transcript with you.</h1>
          <p className={styles.pageLede}>
            OpenAI is shutting group chats to new groups and putting existing ones read-only on
            their schedule. That is their product. Ours is a room Durable Object you run. If you
            already have a <code>conversations.json</code> download, you can load it into a group
            room here.
          </p>
          <div className={styles.pageActions}>
            <Link href={HOSTED_PATHS.getStarted} className={`${styles.btn} ${styles.btnPrimary}`}>
              Get started
            </Link>
            <a href={docsSiteHref("guides/import-transcript")} className={`${styles.btn} ${styles.btnGhost}`}>
              Import docs
            </a>
          </div>
        </div>
        <div className={styles.pageMeta}>
          <span>
            <strong>400</strong> message cap
          </span>
          <span>
            <strong>JSON</strong> only
          </span>
          <span>
            <strong>No</strong> live sync
          </span>
        </div>
      </header>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>How it works</span>
          <h2 className={styles.pageH2}>One file, one room.</h2>
        </div>
        <div className={styles.pageBody}>
          <ul>
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>What we skip</span>
          <h2 className={styles.pageH2}>No scraping, no invites.</h2>
        </div>
        <div className={styles.pageBody}>
          <ul>
            {SKIPS.map((skip) => (
              <li key={skip}>{skip}</li>
            ))}
          </ul>
        </div>
      </section>

      <div className={styles.pageCta}>
        <div>
          <span className={styles.pageEyebrow}>Next</span>
          <p className={styles.pageH2}>Open a room, import the JSON.</p>
          <p>Hosted is beta. Keep the original export; the import is one-way.</p>
        </div>
        <div className={styles.pageActions}>
          <Link href={HOSTED_PATHS.console} className={`${styles.btn} ${styles.btnPrimary}`}>
            Open the console
          </Link>
          <Link href="/guides" className={`${styles.btn} ${styles.btnGhost}`}>
            Guides
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
