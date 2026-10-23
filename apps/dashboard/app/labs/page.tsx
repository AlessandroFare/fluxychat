import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/site-metadata";
import { HOSTED_PATHS, docsSiteHref } from "@/lib/hosted-product";
import { ROOM_CATALOG, ROOM_STATUS_LEGEND, roomBySlug, roomPageHref } from "@/lib/room-catalog";
import { MarketingShell } from "../components/marketing-shell";
import styles from "../landing/landing-c.module.css";
import { LabsWorkerVerticals } from "./labs-worker-verticals";

export const metadata: Metadata = buildPageMetadata({
  title: "Labs: huddles, spatial, cartography",
  description:
    "Huddles media, spatial scenes, cartography, and WebTransport stay labs. Stream, game, IoT, and fleet persist on the Worker.",
  path: "/labs",
});

const LABS = ROOM_CATALOG.filter((room) => room.status === "Labs");
const WORKER_ROOMS = ROOM_CATALOG.filter((room) => room.status === "Worker");
const voice = roomBySlug("voice-ai");

const LAB_NOTES = [
  {
    title: "Spatial / Twin",
    body: "A room can carry a scene graph and AR overlay state. It stays a lab until a design partner takes it to production.",
    href: "/solutions/spatial-twin",
    label: "Open the lab page",
  },
  {
    title: "AI Transport",
    body: "WebTransport negotiation with an explicit WebSocket fallback. It does not replace the room socket today.",
    href: "/solutions/ai-transport",
    label: "Open the lab page",
  },
  {
    title: "Huddles media",
    body: "joinVoiceStage is signaling, not an SFU we sell. Live audio is LiveKit when configured; recorded clips land as room messages.",
    href: voice ? roomPageHref(voice) : HOSTED_PATHS.docs,
    label: "Voice AI surface",
  },
  {
    title: "Cartography",
    body: "Map scenes and place data are useful for prototypes. They are not a routing engine, a tile bundle, or a geocoder.",
    href: docsSiteHref("platform/vertical-industries"),
    label: "Read the platform note",
  },
] as const;

export default function LabsPage() {
  return (
    <MarketingShell className={styles.pageWide}>
      <div className={styles.pageHero}>
        <div className={styles.pageHeroCopy}>
          <span className={styles.pageEyebrow}>Labs / no GA promise</span>
          <h1 className={styles.pageTitle}>Still labs on purpose.</h1>
          <p className={styles.pageLede}>
            Spatial scenes, WebTransport, and huddle media stay here. Stream, game, IoT, and fleet
            write D1 and fan out on the room. We do not sell healthcare, we do not include a BAA,
            and joinVoiceStage is signaling, not an SFU.
          </p>
          <div className={styles.pageActions}>
            <Link href="/#rooms" className={`${styles.btn} ${styles.btnPrimary}`}>
              See the room atlas
            </Link>
            <a href={docsSiteHref("platform/vertical-industries")} className={`${styles.btn} ${styles.btnGhost}`}>
              Read the docs
            </a>
          </div>
        </div>
        <div className={styles.pageMeta}>
          <span>
            <strong>{LABS.length}</strong> labs
          </span>
          <span>
            <strong>{WORKER_ROOMS.length}</strong> worker rooms
          </span>
          <span>
            <strong>0</strong> GA promises
          </span>
        </div>
      </div>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>The line</span>
          <h2 className={styles.pageH2}>A lab is a prototype with a door.</h2>
        </div>
        <div className={styles.pageBody}>
          <p>
            A lab can be real enough to prototype against. It is not a license to put it in a
            customer path. The schema, the media path, and the browser support can move. Pin the
            SDK, read the limit, and keep a fallback.
          </p>
          <p>
            Worker rooms are different: chat core, stream, game, IoT, and fleet run on the Worker
            and D1 today. They share the room and the transcript. Labs sit beside them, clearly
            labelled.
          </p>
        </div>
      </section>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Open labs</span>
          <h2 className={styles.pageH2}>Four doors we keep open.</h2>
        </div>
        <div className={styles.pageBody}>
          <div className={styles.pageCards}>
            {LAB_NOTES.map((lab) => (
              <div key={lab.title} className={styles.pageCard}>
                <span className={styles.planTag}>Labs</span>
                <h3>{lab.title}</h3>
                <p>{lab.body}</p>
                <Link href={lab.href} className={styles.pageCardLink}>
                  {lab.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.pageSection}>
        <div className={styles.pageSectionHead}>
          <span className={styles.pageEyebrow}>Prototype routes</span>
          <h2 className={styles.pageH2}>Two catalog labs, no theatre.</h2>
        </div>
        <div className={styles.pageBody}>
          <div className={styles.pageTableWrap}>
            <table className={styles.pageTable}>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Status</th>
                  <th>What it is</th>
                </tr>
              </thead>
              <tbody>
                {LABS.map((room) => (
                  <tr key={room.slug}>
                    <td>
                      <Link href={roomPageHref(room)}>{room.name}</Link>
                    </td>
                    <td>{room.status}</td>
                    <td>{room.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.mono}>Statuses: {Object.entries(ROOM_STATUS_LEGEND).map(([key, value]) => `${key} = ${value}`).join(" · ")}</p>
        </div>
      </section>

      <LabsWorkerVerticals />

      <div className={styles.pageCta}>
        <div>
          <span className={styles.pageEyebrow}>Next</span>
          <p className={styles.pageH2}>Start with a room that is not a lab.</p>
          <p>
            Chat core is the baseline. Add a Worker surface when the flow needs it. Keep the
            prototype on the side until it earns a customer.
          </p>
        </div>
        <div className={styles.pageActions}>
          <Link href="/#rooms" className={`${styles.btn} ${styles.btnPrimary}`}>
            Browse all rooms
          </Link>
          <Link href="/pricing" className={`${styles.btn} ${styles.btnGhost}`}>
            See pricing
          </Link>
        </div>
      </div>
    </MarketingShell>
  );
}
