"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CornerUpLeft } from "lucide-react";
import {
  FEATURED_ROOMS,
  ROOM_STATUS_LEGEND,
  SUPPORTING_ROOMS,
  roomPageHref,
  type RoomCatalogEntry,
  type RoomStatus,
} from "@/lib/room-catalog";
import { LandingCursor } from "./landing-cursor";
import { SplitText } from "./landing-text";
import { RoomPlate } from "./room-plate";
import styles from "./landing-c.module.css";

const FIGURE_HEIGHT = 30;
const FIGURE_WIDTH = 18;

function waitAnimation(animation: Animation): Promise<boolean> {
  return animation.finished.then(
    () => true,
    () => false,
  );
}

export function LandingRoomAtlas() {
  const [selected, setSelected] = useState<RoomCatalogEntry | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const walkerRef = useRef<HTMLDivElement>(null);
  const ladderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (selected && !dialog.open) dialog.showModal();
    if (!selected && dialog.open) dialog.close();
  }, [selected]);

  useEffect(() => {
    const stage = stageRef.current;
    const walker = walkerRef.current;
    const ladder = ladderRef.current;
    if (!stage || !walker || !ladder) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wide = window.matchMedia("(min-width: 901px)").matches;
    if (reduced || !wide || typeof IntersectionObserver === "undefined") return;
    if (typeof walker.animate !== "function") return;

    let cancelled = false;
    let started = false;
    let observer: IntersectionObserver | null = null;
    const animations: Animation[] = [];
    let x = 0;
    let y = 0;

    const setPosition = (nextX: number, nextY: number) => {
      x = nextX;
      y = nextY;
      walker.style.transform = `translate3d(${x}px, ${y - FIGURE_HEIGHT}px, 0)`;
    };

    const move = async (nextX: number, nextY: number, duration: number, climbing = false) => {
      const from = `translate3d(${x}px, ${y - FIGURE_HEIGHT}px, 0)`;
      const to = `translate3d(${nextX}px, ${nextY - FIGURE_HEIGHT}px, 0)`;
      walker.classList.toggle(styles.walkerClimbing, climbing);
      const animation = walker.animate(
        [
          { transform: from },
          { transform: to },
        ],
        { duration, easing: "cubic-bezier(0.4, 0, 0.6, 1)", fill: "none" },
      );
      animations.push(animation);
      const ok = await waitAnimation(animation);
      walker.classList.remove(styles.walkerClimbing);
      if (!ok || cancelled) return false;
      setPosition(nextX, nextY);
      return true;
    };

    const run = async () => {
      const cards = Array.from(stage.querySelectorAll<HTMLButtonElement>("[data-walker-card]"));
      if (cards.length < 2) return;
      const stageRect = stage.getBoundingClientRect();
      const rects = cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return {
          left: rect.left - stageRect.left,
          right: rect.right - stageRect.left,
          top: rect.top - stageRect.top,
        };
      });

      stage.dataset.walker = "on";
      walker.style.opacity = "1";
      setPosition(rects[0].left + 22, rects[0].top);
      await new Promise((resolve) => window.setTimeout(resolve, 180));
      if (cancelled) return;
      walker.classList.add(styles.walkerWalking);

      for (let index = 0; index < rects.length; index += 1) {
        const card = rects[index];
        const walked = await move(card.right - 22, card.top, 720);
        if (!walked) return;
        const next = rects[index + 1];
        if (!next) break;

        await new Promise((resolve) => window.setTimeout(resolve, 90));
        if (cancelled) return;

        const ladderX = (card.right + next.left) / 2 + 2;
        const stepped = await move(ladderX, card.top, 240);
        if (!stepped) return;

        const top = Math.min(card.top, next.top);
        const height = Math.abs(card.top - next.top) + 2;
        ladder.style.left = `${ladderX - 9}px`;
        ladder.style.top = `${top}px`;
        ladder.style.height = `${height}px`;
        ladder.style.opacity = "1";
        ladder.style.transform = "scaleY(0)";
        const build = ladder.animate(
          [
            { transform: "scaleY(0)", opacity: 0 },
            { transform: "scaleY(1)", opacity: 1 },
          ],
          { duration: 280, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "none" },
        );
        animations.push(build);
        if (!(await waitAnimation(build)) || cancelled) return;
        ladder.style.transform = "scaleY(1)";

        walker.classList.remove(styles.walkerWalking);
        const climbed = await move(ladderX, next.top, 520, true);
        if (!climbed) return;
        walker.classList.add(styles.walkerWalking);

        const entered = await move(next.left + 22, next.top, 260);
        if (!entered) return;

        ladder.style.opacity = "0";
        ladder.style.transform = "scaleY(1)";
      }

      walker.classList.remove(styles.walkerWalking);
      await new Promise((resolve) => window.setTimeout(resolve, 260));
      if (!cancelled) walker.style.opacity = "0";
    };

    const start = () => {
      if (started || cancelled) return;
      started = true;
      const fontsReady = document.fonts?.ready;
      if (fontsReady) {
        fontsReady
          .then(() => {
            if (!cancelled) window.setTimeout(() => void run(), 80);
          })
          .catch(() => {
            if (!cancelled) void run();
          });
      } else {
        window.setTimeout(() => void run(), 80);
      }
    };

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          observer = null;
          start();
        }
      },
      { threshold: 0.32 },
    );
    observer.observe(stage);

    return () => {
      cancelled = true;
      observer?.disconnect();
      for (const animation of animations) animation.cancel();
      delete stage.dataset.walker;
      walker.style.opacity = "0";
      walker.style.transform = "";
      walker.classList.remove(styles.walkerWalking, styles.walkerClimbing);
      ladder.style.opacity = "0";
    };
  }, []);

  const openRoom = (room: RoomCatalogEntry, trigger: HTMLElement) => {
    lastTriggerRef.current = trigger;
    setSelected(room);
  };

  const handleRoomClick = (event: MouseEvent<HTMLAnchorElement>, room: RoomCatalogEntry) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    openRoom(room, event.currentTarget);
  };

  const closeModal = () => {
    dialogRef.current?.close();
  };

  const onDialogClose = () => {
    setSelected(null);
    const trigger = lastTriggerRef.current;
    lastTriggerRef.current = null;
    window.setTimeout(() => trigger?.focus(), 0);
  };

  return (
    <section className={`${styles.section} ${styles.wrap} ${styles.atlasSection}`} id="rooms" data-fx>
      <div className={styles.atlasWall} aria-hidden="true">
        <span className={`${styles.wallShape} ${styles.wallSun}`} />
        <span className={`${styles.wallShape} ${styles.wallRing}`} />
        <span className={`${styles.wallShape} ${styles.wallChecker}`} />
        <span className={`${styles.wallShape} ${styles.wallArc}`} />
      </div>

      <div className={styles.sectionHead} data-fx-rise>
        <span className={styles.label}>Room atlas</span>
        <h2 className={styles.h2}>
          <SplitText text="Every surface has the same room behind it." />
        </h2>
        <p className={styles.sectionLead}>
          Chat core plus eleven surfaces. Each card opens a terminal preview, then a page with the
          real API, the honest limit, and a way into the console.
        </p>
      </div>

      <div className={styles.atlasStage} ref={stageRef}>
        <div className={styles.atlasFeatured}>
          {FEATURED_ROOMS.map((room) => (
            <Link
              key={room.slug}
              href={roomPageHref(room)}
              data-walker-card
              className={styles.atlasCard}
              onClick={(event) => handleRoomClick(event, room)}
              aria-haspopup="dialog"
            >
              <RoomPlate room={room} />
              <span className={styles.atlasMeta}>
                <span className={styles.atlasTag}>{room.tag}</span>
                <span className={styles.atlasStatus}>{room.status}</span>
              </span>
              <h3 className={styles.atlasName}>{room.name}</h3>
              <p className={styles.atlasSummary}>{room.summary}</p>
              <span className={styles.atlasOpen}>
                Preview <ArrowUpRight aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>

        <div
          ref={walkerRef}
          className={styles.walker}
          aria-hidden="true"
          style={{ width: FIGURE_WIDTH }}
        >
          <span className={styles.walkerHead} />
          <span className={styles.walkerTorso} />
          <span className={styles.walkerLegA} />
          <span className={styles.walkerLegB} />
        </div>
        <div ref={ladderRef} className={styles.ladder} aria-hidden="true" />
      </div>

      <div className={styles.atlasList}>
        {SUPPORTING_ROOMS.map((room) => (
          <Link
            key={room.slug}
            href={roomPageHref(room)}
            className={styles.atlasRow}
            onClick={(event) => handleRoomClick(event, room)}
            aria-haspopup="dialog"
          >
            <RoomPlate room={room} variant="row" />
            <span className={styles.atlasRowName}>{room.name}</span>
            <span className={styles.atlasRowSummary}>{room.summary}</span>
            <span className={styles.atlasStatus}>{room.status}</span>
            <ArrowUpRight className={styles.atlasRowArrow} aria-hidden="true" />
          </Link>
        ))}
      </div>

      <div className={styles.atlasLegend} aria-label="Room status legend">
        {(Object.keys(ROOM_STATUS_LEGEND) as RoomStatus[]).map((status) => (
          <span key={status}>
            <strong>{status}</strong> {ROOM_STATUS_LEGEND[status]}
          </span>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className={styles.roomDialog}
        aria-labelledby={selected ? `room-dialog-title-${selected.slug}` : undefined}
        onClose={onDialogClose}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeModal();
        }}
      >
        {selected ? (
          <div className={styles.roomDialogInner}>
            <div className={styles.roomDialogBar}>
              <span className={styles.roomDialogLead}>
                <span className={styles.roomDialogDots} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span>room://{selected.slug}</span>
              </span>
              <span>{selected.status}</span>
            </div>
            <button
              type="button"
              className={styles.roomDialogClose}
              onClick={closeModal}
              aria-label="Back to the room card"
            >
              <CornerUpLeft aria-hidden="true" />
            </button>
            <div className={styles.roomDialogBody}>
              <RoomPlate room={selected} variant="detail" className={styles.roomDialogPlate} />
              <span className={styles.dialogLabel}>{selected.tag}</span>
              <h2 id={`room-dialog-title-${selected.slug}`} className={styles.dialogTitle}>
                {selected.name}
              </h2>
              <p className={styles.dialogDescription}>{selected.description}</p>
              <ul className={styles.dialogList}>
                {selected.surfaces.map((surface) => (
                  <li key={surface}>{surface}</li>
                ))}
              </ul>
              <p className={styles.dialogLimit}>
                <span>Not for</span> {selected.notFor}
              </p>
              <div className={styles.dialogActions}>
                <Link href={roomPageHref(selected)} className={`${styles.btn} ${styles.btnPrimary}`}>
                  Open the room page
                  <ArrowRight aria-hidden="true" />
                </Link>
                {selected.consoleHref ? (
                  <Link href={selected.consoleHref} className={`${styles.btn} ${styles.btnGhost}`}>
                    Console
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        {selected ? <LandingCursor /> : null}
      </dialog>
    </section>
  );
}
