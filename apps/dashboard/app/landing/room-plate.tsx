import type { ReactNode } from "react";
import type { RoomCatalogEntry, RoomGlyph } from "@/lib/room-catalog";
import styles from "./landing-c.module.css";

type PlateVariant = "card" | "row" | "detail";

function paletteClass(palette: RoomCatalogEntry["palette"]): string {
  return styles[`plate${palette[0].toUpperCase()}${palette.slice(1)}`] ?? "";
}

function glyphShapes(glyph: RoomGlyph): ReactNode {
  switch (glyph) {
    case "orbit":
      return (
        <>
          <path
            d="M126 44c30-22 82-20 102 12 18 28 14 66-10 86-24 20-62 24-90 10-28-14-44-40-42-64 2-18 16-32 40-44z"
            className={styles.plateA}
          />
          <rect
            x="48"
            y="118"
            width="112"
            height="44"
            rx="20"
            transform="rotate(-8 104 140)"
            className={styles.plateB}
          />
          <circle cx="232" cy="140" r="22" className={styles.plateC} />
        </>
      );
    case "grid":
      return (
        <>
          <rect x="58" y="46" width="70" height="70" transform="rotate(-4 93 81)" className={styles.plateB} />
          <rect x="140" y="58" width="82" height="62" transform="rotate(3 181 89)" className={styles.plateA} />
          <rect x="200" y="116" width="56" height="46" transform="rotate(-5 228 139)" className={styles.plateC} />
          <rect x="66" y="132" width="46" height="16" rx="8" transform="rotate(-4 89 140)" className={styles.plateB} />
        </>
      );
    case "wave":
      return (
        <>
          <path
            d="M34 124C64 66 102 66 136 126s72 58 148-10v44c-76 68-114 68-148 8S64 108 34 168z"
            className={styles.plateC}
          />
          <circle cx="238" cy="68" r="34" className={styles.plateA} />
          <rect x="54" y="56" width="36" height="14" rx="7" transform="rotate(-6 72 63)" className={styles.plateB} />
        </>
      );
    case "spark":
      return (
        <>
          <path d="M162 44 250 164 74 164Z" className={styles.plateB} />
          <circle cx="162" cy="118" r="32" className={styles.plateA} />
          <rect x="52" y="56" width="48" height="14" rx="7" transform="rotate(-6 76 63)" className={styles.plateC} />
        </>
      );
    case "arch":
      return (
        <>
          <path d="M50 166v-54a52 52 0 0 1 104 0v54z" className={styles.plateB} />
          <path d="M126 166v-32a34 34 0 0 1 68 0v32z" className={styles.plateA} />
          <circle cx="250" cy="68" r="18" className={styles.plateC} />
        </>
      );
    case "checker":
      return (
        <>
          <circle cx="96" cy="72" r="26" className={styles.plateB} />
          <circle cx="156" cy="52" r="17" className={styles.plateA} />
          <circle cx="206" cy="86" r="12" className={styles.plateC} />
          <circle cx="240" cy="126" r="24" className={styles.plateB} />
          <circle cx="150" cy="132" r="20" className={styles.plateA} />
          <rect x="76" y="160" width="140" height="14" rx="7" className={styles.plateC} />
        </>
      );
    default:
      return null;
  }
}

export function RoomPlate({
  room,
  variant = "card",
  className = "",
}: {
  room: RoomCatalogEntry;
  variant?: PlateVariant;
  className?: string;
}) {
  const uid = `plate-${room.slug}-${variant}`;

  return (
    <div
      className={`${styles.plate} ${variant === "row" ? styles.plateRow : ""} ${
        variant === "detail" ? styles.plateDetail : ""
      } ${paletteClass(room.palette)} ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 320 200" className={styles.plateSvg} preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id={`${uid}-paper`} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.028"
              numOctaves="2"
              seed="9"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="5.5"
              xChannelSelector="R"
              yChannelSelector="G"
              result="cut"
            />
            <feDropShadow
              in="cut"
              dx="0"
              dy="2"
              stdDeviation="1.8"
              floodColor="#2a251c"
              floodOpacity="0.14"
            />
          </filter>
        </defs>
        <rect width="320" height="200" className={styles.plateBg} />
        <g filter={`url(#${uid}-paper)`} className={styles.platePaper}>
          {glyphShapes(room.glyph)}
        </g>
      </svg>
    </div>
  );
}
