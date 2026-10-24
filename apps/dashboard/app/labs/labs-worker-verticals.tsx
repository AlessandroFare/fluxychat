import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "../landing/landing-c.module.css";

/** Verticals that already run on the Worker; each deep-links to its console page. */
export const LABS_WORKER_VERTICALS = [
  { href: "/stream", label: "FluxyStream", blurb: "Broadcast, HLS, and chat overlay on one room." },
  { href: "/game", label: "FluxyGame", blurb: "Matchmaking, room ticks, and leaderboards." },
  { href: "/iot", label: "FluxyIoT", blurb: "HTTP ingest, device shadow, room fan-out." },
  { href: "/fleet", label: "Fleet", blurb: "Live GPS tracks, trips, and delivery." },
] as const;

export function LabsWorkerVerticals() {
  return (
    <section className={styles.pageSection} aria-labelledby="labs-worker-heading">
      <div className={styles.pageSectionHead}>
        <span className={styles.pageEyebrow}>Worker rooms</span>
        <h2 id="labs-worker-heading" className={styles.pageH2}>
          These already run on your Worker
        </h2>
      </div>
      <div className={styles.pageBody}>
        <p>
          Stream, game, IoT, and fleet write D1 and fan out on the room. The deep links open the
          console page; everything else on this page stays labs.
        </p>
        <div className={styles.pageCards}>
          {LABS_WORKER_VERTICALS.map((vertical) => (
            <div key={vertical.href} className={styles.pageCard}>
              <span className={styles.planTag}>Worker</span>
              <h3>{vertical.label}</h3>
              <p>{vertical.blurb}</p>
              <Link href={vertical.href} className={styles.pageCardLink}>
                Open {vertical.label}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
