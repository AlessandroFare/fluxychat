import Link from "next/link";
import { ALL_GUIDES } from "@/lib/guides/related-guides";
import { DEVTO_SOCKET_FLEET_ARTICLE } from "@/lib/marketing-links";
import { buildPageMetadata } from "@/lib/site-metadata";
import { docsSiteHref, guideDocsHref, HOSTED_PATHS } from "@/lib/hosted-product";
import { DocsSearch } from "@/components/doc-search";
import { MarketingShell } from "../components/marketing-shell";
import styles from "../landing/landing-c.module.css";

export const metadata = buildPageMetadata({
  title: "Guides: edge chat on Cloudflare",
  description:
    "Guides for Workers chat, platform modules, Vercel + Cloudflare split, leaving Pusher, and in-app chat vs support desk.",
  path: "/guides",
});

export default function GuidesIndexPage() {
  return (
    <MarketingShell className={styles.pageNarrow}>
      <header className={styles.pageHero}>
        <div className={styles.pageHeroCopy}>
          <span className={styles.pageEyebrow}>Guides / edge chat</span>
          <h1 className={styles.pageTitle}>Build close to the room.</h1>
          <p className={styles.pageLede}>
            Edge-native realtime: chat, AI agents, stream, collab, and IoT on one Worker. Each topic
            also lives on the docs site with search and Ask AI. Try the playground without signup.
          </p>
          <div className={styles.pageActions}>
            <Link href="/demo" className={`${styles.btn} ${styles.btnPrimary}`}>
              Open the playground
            </Link>
            <a href={docsSiteHref("")} className={`${styles.btn} ${styles.btnGhost}`}>
              Docs site
            </a>
          </div>
        </div>
        <div className={styles.pageMeta}>
          <span>
            <strong>{ALL_GUIDES.length}</strong> guides
          </span>
          <span>
            <strong>Workers</strong> + D1
          </span>
          <span>
            <strong>MIT</strong> self-host
          </span>
        </div>
      </header>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Search</span>
          <h2 className={styles.pageH2}>Find the shortest path.</h2>
        </div>
        <div className={styles.pageBody}>
          <DocsSearch variant="light" />
        </div>
      </section>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>All guides</span>
          <h2 className={styles.pageH2}>Start with the mechanism.</h2>
        </div>
        <div className={styles.pageBody}>
          <div className={styles.pageTableWrap}>
            <table className={styles.pageTable}>
              <thead>
                <tr>
                  <th>Guide</th>
                  <th>Path</th>
                  <th>Docs</th>
                </tr>
              </thead>
              <tbody>
                {ALL_GUIDES.map((guide) => (
                  <tr key={guide.href}>
                    <td>
                      <Link href={guide.href}>{guide.label}</Link>
                    </td>
                    <td>
                      <code>{guide.href}</code>
                    </td>
                    <td>
                      <a href={guideDocsHref(guide.href)}>Read on docs</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Long form</span>
          <h2 className={styles.pageH2}>One walkthrough, no upsell.</h2>
        </div>
        <div className={styles.pageBody}>
          <p>
            <a href={DEVTO_SOCKET_FLEET_ARTICLE.href} target="_blank" rel="noopener noreferrer">
              {DEVTO_SOCKET_FLEET_ARTICLE.title}
            </a>{" "}
            goes through the socket fleet model and the tradeoffs behind one Durable Object per room.
          </p>
        </div>
      </section>

      <div className={styles.pageCta}>
        <div>
          <span className={styles.pageEyebrow}>Next</span>
          <p className={styles.pageH2}>Read the quickstart, then open a room.</p>
          <p>No signup for the playground. Sign up when you want your own project and keys.</p>
        </div>
        <div className={styles.pageActions}>
          <a href={docsSiteHref("getting-started/quickstart")} className={`${styles.btn} ${styles.btnPrimary}`}>
            Quickstart on docs
          </a>
          <Link href={HOSTED_PATHS.compare} className={`${styles.btn} ${styles.btnGhost}`}>
            Compare approaches
          </Link>
          <Link href={HOSTED_PATHS.getStarted} className={`${styles.btn} ${styles.btnGhost}`}>
            Get started
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
