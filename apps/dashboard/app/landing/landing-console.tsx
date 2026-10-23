import type { CSSProperties } from "react";
import styles from "./landing-c.module.css";

const CHANNELS = [
  {
    id: "room_7f3a",
    state: "live",
    people: ["a", "a", "agent"],
    occupancy: "2 humans · 1 agent",
    readout: "msg 214 · since 09:14",
    fader: 0.72,
  },
  {
    id: "room_k9xq",
    state: "warm",
    people: ["a", "off", "off"],
    occupancy: "1 human",
    readout: "msg 31 · since 22:02",
    fader: 0.45,
  },
  {
    id: "room_p8q1",
    state: "live",
    people: ["a", "agent", "off"],
    occupancy: "1 human · 1 agent",
    readout: "msg 1 204 · since 03 Sep",
    fader: 0.84,
  },
  {
    id: "room_m2v8",
    state: "warm",
    people: ["a", "off", "agent"],
    occupancy: "1 human · 1 agent",
    readout: "asleep · woke 4h ago",
    fader: 0.12,
  },
] as const;

/** The product itself as the first-screen image: four room channels, live. */
export function LandingConsole() {
  return (
    <section className={`${styles.console} ${styles.boot}`} aria-label="Live console of four demo rooms">
      <div className={styles.consoleInner}>
        {CHANNELS.map((ch, i) => (
          <div key={ch.id} className={`${styles.channel} ${styles[`c${i + 1}`]}`}>
            <div className={styles.chHead}>
              <span className={styles.chId}>{ch.id}</span>
              <span
                className={`${styles.status} ${ch.state === "live" ? styles.statusLive : styles.statusWarm}`}
              >
                <span className={styles.dot} aria-hidden />
                {ch.state === "live" ? "live" : "warm"}
              </span>
            </div>
            <div className={styles.occupancy} aria-hidden>
              {ch.people.map((p, idx) => (
                <span
                  key={`${ch.id}-${idx}`}
                  className={`${styles.person} ${p === "agent" ? styles.personAgent : ""} ${
                    p === "off" ? styles.personOff : ""
                  }`}
                />
              ))}
              <span>{ch.occupancy}</span>
            </div>
            <div className={styles.meter} aria-hidden>
              <span className={styles.fill} />
            </div>
            <div className={styles.readout}>{ch.readout}</div>
            <div
              className={styles.fader}
              role="img"
              aria-label="activity fader"
              style={{ "--p": ch.fader } as CSSProperties}
            >
              <span className={styles.faderTrack} aria-hidden />
              <span className={styles.faderThumb} aria-hidden />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
