"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./landing-c.module.css";

type LogKind = "room" | "you" | "agent";

type LogEntry = {
  id: number;
  kind: LogKind;
  text: string;
  typing?: boolean;
  replay?: boolean;
};

type Note = { id: number; x: number; y: number; label: string };

const LABELS = ["ship it", "on it", "hold", "lgtm"];
const AGENT_REPLY = "Read the timeline: 3 cursors, 2 notes, nothing waiting.";
const SEED: LogEntry[] = [
  { id: 1, kind: "room", text: "general opened · history resumes from D1 after a reconnect" },
  { id: 2, kind: "agent", text: "Standing by. Agents stream on the same socket as the humans." },
];

/**
 * Simulated room: presence, fan-out, agent and D1 replay in one panel.
 * Nothing here talks to the Worker; the buttons are the honest part.
 */
export function LandingLiveRoom() {
  const [log, setLog] = useState<LogEntry[]>(SEED);
  const [notes, setNotes] = useState<Note[]>([]);
  const [agentBusy, setAgentBusy] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const youRef = useRef<HTMLSpanElement>(null);
  const timers = useRef<number[]>([]);
  const seq = useRef(3);
  const noteSeq = useRef(0);

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const drop = (x: number, y: number) => {
    const label = LABELS[noteSeq.current++ % LABELS.length];
    const noteId = seq.current++;
    setNotes((prev) => [...prev.slice(-4), { id: noteId, x, y, label }]);
    later(() => setNotes((prev) => prev.filter((note) => note.id !== noteId)), 3200);
    setLog((prev) => [
      ...prev.slice(-7),
      { id: seq.current++, kind: "you", text: `dropped “${label}” · fanned out to 3 clients` },
    ]);
  };

  const dropFromButton = () => {
    const step = noteSeq.current % 3;
    drop(26 + step * 22, 34 + (step % 2) * 24);
  };

  const invokeAgent = () => {
    if (agentBusy) return;
    setAgentBusy(true);
    const id = seq.current++;
    setLog((prev) => [...prev.slice(-7), { id, kind: "agent", text: "", typing: true }]);
    later(() => {
      setLog((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, text: AGENT_REPLY, typing: false } : entry)),
      );
      setAgentBusy(false);
    }, 1200);
  };

  const replay = () => {
    if (replaying) return;
    setReplaying(true);
    const snapshot = log.length > 0 ? log : SEED;
    setLog([]);
    snapshot.forEach((entry, index) => {
      later(
        () =>
          setLog((prev) => [
            ...prev.slice(-7),
            { ...entry, id: seq.current++, typing: false, replay: true },
          ]),
        200 * (index + 1),
      );
    });
    later(() => setReplaying(false), 200 * (snapshot.length + 1) + 100);
  };

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = youRef.current;
    if (!el || event.pointerType === "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    el.style.transform = `translate(${event.clientX - rect.left}px, ${event.clientY - rect.top}px)`;
    el.dataset.on = "true";
  };

  const onLeave = () => {
    if (youRef.current) delete youRef.current.dataset.on;
  };

  const onStageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    drop(
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100,
    );
  };

  return (
    <div className={styles.livePanel}>
      <div className={styles.liveBar}>
        <span className={styles.liveRoom}>room://general</span>
        <span className={styles.livePresence}>
          <span className={styles.liveDot} aria-hidden="true" />3 present · 1 agent
        </span>
      </div>
      <div className={styles.liveBody}>
        <div
          className={styles.liveStage}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          onClick={onStageClick}
        >
          <span ref={youRef} className={styles.liveCursorYou} aria-hidden="true">
            <span className={styles.liveCursorDot} />
            <span className={styles.liveCursorTag}>You</span>
          </span>
          <span className={`${styles.liveCursorYou} ${styles.liveCursorSam}`} aria-hidden="true">
            <span className={styles.liveCursorDot} />
            <span className={styles.liveCursorTag}>Sam</span>
          </span>
          {notes.map((note) => (
            <span
              key={note.id}
              className={styles.liveNote}
              style={{ left: `${note.x}%`, top: `${note.y}%` }}
            >
              {note.label}
            </span>
          ))}
          <span className={styles.liveHint}>click anywhere in the room</span>
        </div>
        <div className={styles.liveLog}>
          <div className={styles.liveLogHead}>
            <span>Timeline</span>
            <span>{log.length} events</span>
          </div>
          <ul className={styles.liveLogList} aria-live="polite">
            {log.map((entry) => (
              <li
                key={entry.id}
                className={styles.liveLogItem}
                data-kind={entry.kind}
                data-replay={entry.replay ? "true" : undefined}
              >
                <span className={styles.liveLogKind}>{entry.kind}</span>
                {entry.typing ? (
                  <span className={styles.liveTyping} aria-label="Agent typing">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  <span className={styles.liveLogText}>{entry.text}</span>
                )}
                {entry.replay ? <span className={styles.liveLogTag}>D1</span> : null}
              </li>
            ))}
          </ul>
          <div className={styles.liveActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`}
              onClick={dropFromButton}
            >
              Drop a note
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSmall}`}
              onClick={invokeAgent}
              disabled={agentBusy}
            >
              Invoke agent
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSmall}`}
              onClick={replay}
              disabled={replaying}
            >
              Replay from D1
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
