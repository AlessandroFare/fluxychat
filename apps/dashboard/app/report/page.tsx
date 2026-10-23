import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "../components/marketing-shell";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { buildPageMetadata } from "@/lib/site-metadata";
import { DsaReportForm } from "./dsa-report-form";
import styles from "../landing/landing-c.module.css";

export const metadata: Metadata = buildPageMetadata({
  title: "Report illegal content — FluxyChat",
  description:
    "Notice-and-action form for hosted FluxyChat share pages. Hosting duties under the EU DSA. Not legal advice.",
  path: "/report",
});

export default function ReportPage() {
  return (
    <MarketingShell className={styles.pageNarrow}>
      <header className={styles.pageHero}>
        <div className={styles.pageHeroCopy}>
          <span className={styles.pageEyebrow}>DSA / hosting notice</span>
          <h1 className={styles.pageTitle}>Report illegal content.</h1>
          <p className={styles.pageLede}>
            Hosted FluxyChat stores share pages and room data. If you think a public URL is illegal,
            send a notice. We are not a very large online platform. This form is a hosting notice,
            not a court filing, and not legal advice.
          </p>
        </div>
        <div className={styles.pageMeta}>
          <span><strong>Hosted</strong> share pages</span>
          <span><strong>48-hex</strong> tokens</span>
          <span><strong>No</strong> legal advice</span>
        </div>
      </header>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>What we need</span>
          <h2 className={styles.pageH2}>Exact URL, contact, good faith.</h2>
        </div>
        <div className={styles.pageBody}>
          <p>
            If the path is <code>/share/</code> plus a 48-hex token, we revoke that token. We do not
            mint a replacement. The operator may still have the room.
          </p>
          <DsaReportForm />
        </div>
      </section>
      <p className="mt-8 text-sm">
        Trusted flagger / DSA contact:{" "}
        <a className="text-brand underline underline-offset-2" href="mailto:support@fluxychat.com">
          support@fluxychat.com
        </a>
        {" · "}
        <Link className="text-brand underline underline-offset-2" href={HOSTED_PATHS.trust}>
          Trust
        </Link>
        {" · "}
        <a className="text-brand underline underline-offset-2" href="/.well-known/security.txt">
          security.txt
        </a>
      </p>
    </MarketingShell>
  );
}
