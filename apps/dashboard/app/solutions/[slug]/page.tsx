import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { buildPageMetadata } from "@/lib/site-metadata";
import {
  ROOM_CATALOG,
  ROOM_STATUS_LEGEND,
  roomBySlug,
  roomPageHref,
} from "@/lib/room-catalog";
import {
  HOSTED_PATHS,
  consoleEntryHref,
  docsSiteHref,
  isClerkClientConfigured,
} from "@/lib/hosted-product";
import { cMono, cSans } from "../../landing/c-fonts";
import { LandingFooter, LandingHeader } from "../../landing/landing-chrome";
import { LandingMotion } from "../../landing/landing-motion";
import { RoomPlate } from "../../landing/room-plate";
import styles from "../../landing/landing-c.module.css";

type PageProps = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return ROOM_CATALOG.map((room) => ({ slug: room.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const room = roomBySlug(slug);
  if (!room) return buildPageMetadata({ title: "Room not found", description: "", index: false });
  return buildPageMetadata({
    title: `${room.name} - ${room.tag}`,
    description: room.lede,
    path: roomPageHref(room),
  });
}

export default async function RoomPage({ params }: PageProps) {
  const { slug } = await params;
  const room = roomBySlug(slug);
  if (!room) notFound();

  const clerkOn = isClerkClientConfigured();
  const startHref = clerkOn ? HOSTED_PATHS.signUp : HOSTED_PATHS.getStarted;
  const related = ROOM_CATALOG.filter((entry) => entry.slug !== room.slug).slice(0, 3);
  const isLab = room.status === "Labs";

  return (
    <div className={`${styles.root} ${styles.themeable} ${cSans.variable} ${cMono.variable}`}>
      <LandingMotion />
      <LandingHeader startHref={startHref} accountHref={consoleEntryHref()} themeToggle />

      <div className={styles.wrap}>
        <div className={styles.detailMain}>
          <Link href="/#rooms" className={styles.backLink}>
            <span className={styles.backIcon} aria-hidden="true">
              <ArrowLeft />
            </span>
            All rooms
          </Link>

          <section className={styles.detailHero}>
            <div className={styles.detailHeroCopy}>
              <p className={styles.detailStatus}>
                <strong>{room.status}</strong>
                <span>{room.tag}</span>
                <span>{ROOM_STATUS_LEGEND[room.status]}</span>
              </p>
              <h1 className={styles.detailTitle}>{room.name}</h1>
              <p className={styles.detailLede}>{room.lede}</p>
              <div className={styles.detailActions}>
                {room.consoleHref ? (
                  <Link
                    href={room.consoleHref}
                    className={`${styles.btn} ${styles.btnPrimary}`}
                  >
                    Open the console
                    <ArrowRight aria-hidden="true" />
                  </Link>
                ) : null}
                {room.docsSlug ? (
                  <a
                    href={docsSiteHref(room.docsSlug)}
                    className={`${styles.btn} ${styles.btnGhost}`}
                  >
                    Read the docs
                    <ArrowUpRight aria-hidden="true" />
                  </a>
                ) : (
                  <Link href="/#mechanism" className={`${styles.btn} ${styles.btnGhost}`}>
                    See the kernel
                  </Link>
                )}
              </div>
            </div>
            <div className={styles.detailHeroPlate}>
              <RoomPlate room={room} variant="detail" />
            </div>
          </section>

          <section className={styles.detailGrid}>
            <div className={styles.detailCopy}>
              <h2 className={styles.detailH2}>What runs</h2>
              <ul className={styles.detailSurfaces}>
                {room.surfaces.map((surface) => (
                  <li key={surface}>{surface}</li>
                ))}
              </ul>

              <p className={styles.detailNotFor}>
                <span>Not for</span>
                {room.notFor}
              </p>

              <h2 className={`${styles.detailH2} ${styles.detailWhere}`}>Where it sits</h2>
              <p className={styles.sectionLead}>
                {isLab
                  ? "It is a lab. The API is real enough to prototype against, but it is not a GA promise. Treat the schema and the media path as movable pieces."
                  : "It shares the room socket, history, and agent stream with chat core. Turning it on does not add a second realtime stack or a second place to look for a message."}
              </p>
              <p className={styles.sectionLead}>
                The SDK contract is the room. Start with chat core, attach the surface when the
                flow needs it, and keep the transcript in one place.
              </p>
            </div>

            <aside className={styles.detailSide}>
              <dl className={styles.detailFacts}>
                <div className={styles.detailFact}>
                  <dt>Status</dt>
                  <dd>{room.status}</dd>
                </div>
                <div className={styles.detailFact}>
                  <dt>Runtime</dt>
                  <dd>{room.status === "Module" ? "Room + Worker" : "Worker + D1"}</dd>
                </div>
                <div className={styles.detailFact}>
                  <dt>Data</dt>
                  <dd>Room DO + D1</dd>
                </div>
                <div className={styles.detailFact}>
                  <dt>Licence</dt>
                  <dd>MIT self-host</dd>
                </div>
                <div className={styles.detailFact}>
                  <dt>Entry</dt>
                  <dd>{room.consoleHref ?? "SDK"}</dd>
                </div>
              </dl>
              <p className={styles.detailSideNote}>
                Hosted is beta. Pin SDK versions and read the limit before you put it in a
                customer path.
              </p>

              <div className={styles.detailRelated}>
                {related.map((entry) => (
                  <Link key={entry.slug} href={roomPageHref(entry)}>
                    {entry.name}
                    <span>{entry.status}</span>
                  </Link>
                ))}
              </div>
            </aside>
          </section>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
}
