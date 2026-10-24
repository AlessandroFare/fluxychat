import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "../components/marketing-shell";
import { HOSTED_COPY, HOSTED_PATHS, docsSiteHref } from "@/lib/hosted-product";
import { buildPageMetadata } from "@/lib/site-metadata";
import type { VerticalLandingPage } from "@/lib/vertical-landing";
import styles from "../landing/landing-c.module.css";

export function verticalPageMetadata(page: VerticalLandingPage): Metadata {
  return buildPageMetadata({
    title: page.title,
    description: page.lede,
    path: `/${page.slug}`,
  });
}

export function VerticalUseCasePage({ page }: { page: VerticalLandingPage }) {
  return (
    <MarketingShell className={styles.pageNarrow}>
      <header className={styles.pageHero}>
        <div className={styles.pageHeroCopy}>
          <span className={styles.pageEyebrow}>{page.eyebrow} / use case</span>
          <h1 className={styles.pageTitle}>{page.title}</h1>
          <p className={styles.pageLede}>{page.lede}</p>
          <div className={styles.pageActions}>
            <Link href={HOSTED_PATHS.getStarted} className={`${styles.btn} ${styles.btnPrimary}`}>
              {HOSTED_COPY.startFree}
            </Link>
            <Link href="/#rooms" className={`${styles.btn} ${styles.btnGhost}`}>
              See the rooms
            </Link>
          </div>
        </div>
        <div className={styles.pageMeta}>
          <span>
            <strong>Room</strong> primitive
          </span>
          <span>
            <strong>Bring</strong> your workflow
          </span>
        </div>
      </header>

      {page.sections.map((section) => (
        <section key={section.heading} className={styles.pageSection}>
          <div className={styles.pageSectionHead}>
            <span className={styles.pageEyebrow}>{page.eyebrow}</span>
            <h2 className={styles.pageH2}>{section.heading}</h2>
          </div>
          <div className={styles.pageBody}>
            <p>{section.body}</p>
          </div>
        </section>
      ))}

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Scaffold</span>
          <h2 className={styles.pageH2}>Start from the example.</h2>
        </div>
        <div className={styles.pageBody}>
          <pre className={styles.scaffold}>
            <code>{page.scaffold}</code>
          </pre>
          <p>
            The example is a starting point, not a bespoke integration. Swap the theme, wire your
            auth, and keep the room id server-owned.
          </p>
        </div>
      </section>

      <div className={styles.pageCta}>
        <div>
          <span className={styles.pageEyebrow}>Next</span>
          <p className={styles.pageH2}>Read the contract, then build.</p>
          <p>Hosted is beta. Pin versions and run your own load review before production.</p>
        </div>
        <div className={styles.pageActions}>
          <Link href={HOSTED_PATHS.getStarted} className={`${styles.btn} ${styles.btnPrimary}`}>
            {HOSTED_COPY.startFree}
          </Link>
          <a href={docsSiteHref("getting-started/quickstart")} className={`${styles.btn} ${styles.btnGhost}`}>
            Quickstart
          </a>
          <Link href="/trust" className={`${styles.btn} ${styles.btnGhost}`}>
            Trust
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
