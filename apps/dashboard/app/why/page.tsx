import type { Metadata } from "next";
import Link from "next/link";
import { HOSTED_COPY, HOSTED_PATHS, docsSiteHref } from "@/lib/hosted-product";
import { PAGE_METADATA } from "@/lib/marketing-copy";
import { DEVTO_SOCKET_FLEET_ARTICLE } from "@/lib/marketing-links";
import { WHY_CTA, WHY_FAQ, WHY_SECTIONS, WHY_THESIS } from "@/lib/why-copy";
import { MarketingShell } from "../components/marketing-shell";
import styles from "../landing/landing-c.module.css";

export const metadata: Metadata = PAGE_METADATA.why;

export default function WhyPage() {
  return (
    <MarketingShell className={styles.pageWide}>
      <header className={styles.pageHero}>
        <div className={styles.pageHeroCopy}>
          <span className={styles.pageEyebrow}>Why FluxyChat</span>
          <h1 className={styles.pageTitle}>Why I built FluxyChat.</h1>
          <p className={styles.pageLede}>{WHY_THESIS}</p>
          <div className={styles.pageActions}>
            <Link href={HOSTED_PATHS.getStarted} className={`${styles.btn} ${styles.btnPrimary}`}>
              {HOSTED_COPY.startFree}
            </Link>
            <Link href={HOSTED_PATHS.compare} className={`${styles.btn} ${styles.btnGhost}`}>
              Compare alternatives
            </Link>
          </div>
        </div>
        <div className={styles.pageMeta}>
          <span>
            <strong>Solo</strong> build
          </span>
          <span>
            <strong>Open</strong> beta
          </span>
          <span>
            <strong>MIT</strong> self-host
          </span>
        </div>
      </header>

      {WHY_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className={styles.pageSection}>
          <div className={styles.pageSectionHead}>
            <span className={styles.pageEyebrow}>{section.id}</span>
            <h2 className={styles.pageH2}>{section.title}</h2>
          </div>
          <div className={styles.pageBody}>
            {"paragraphs" in section && section.paragraphs
              ? section.paragraphs.map((paragraph) => <p key={paragraph.slice(0, 60)}>{paragraph}</p>)
              : null}
            {section.bullets ? (
              <ul>
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ))}

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Questions</span>
          <h2 className={styles.pageH2}>The short answers.</h2>
        </div>
        <div className={styles.pageBody}>
          <div className={styles.pageFaq}>
            {WHY_FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.pageCta}>
        <div>
          <span className={styles.pageEyebrow}>Try it</span>
          <p className={styles.pageH2}>{WHY_CTA.title}</p>
          <p>{WHY_CTA.body}</p>
        </div>
        <div className={styles.pageActions}>
          <Link href={HOSTED_PATHS.getStarted} className={`${styles.btn} ${styles.btnPrimary}`}>
            {HOSTED_COPY.startFree}
          </Link>
          <a href={docsSiteHref("quickstart")} className={`${styles.btn} ${styles.btnGhost}`}>
            {HOSTED_COPY.viewDocs}
          </a>
          <a
            href={DEVTO_SOCKET_FLEET_ARTICLE.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.btn} ${styles.btnGhost}`}
          >
            Dev.to guide
          </a>
          <a
            href="https://github.com/AlessandroFare/fluxychat"
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.btn} ${styles.btnGhost}`}
          >
            GitHub
          </a>
        </div>
      </div>
    </MarketingShell>
  );
}
