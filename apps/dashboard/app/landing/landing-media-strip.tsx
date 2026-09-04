"use client";

import dynamic from "next/dynamic";

const AccordionGallery = dynamic(() => import("~/components/AccordionGallery"), { ssr: false });

const GALLERY_ITEMS = [
  {
    image: "/flow/1.png",
    label: "One room WebSocket at the edge",
    alt: "Globe of city lights linked by a single coral filament at the edge",
  },
  {
    image: "/flow/2.png",
    label: "Presence, typing, collab CRDT",
    alt: "Team collaborating around a laptop with overlapping shared pages",
  },
  {
    image: "/flow/3.png",
    label: "Live stage, polls, and overlay",
    alt: "Live stage with a crowd and a subtle overlay of poll bars",
  },
  {
    image: "/flow/4.png",
    label: "Agents on the same worker",
    alt: "Edge server rack and operator in the same light",
  },
  {
    image: "/flow/5.png",
    label: "Bridges you wire in the console",
    alt: "Grid of identical adapters on a cream desk",
  },
];

export function LandingMediaStrip() {
  return (
    <section className="border-b border-[var(--mkt-border)] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-xs font-semibold uppercase text-[var(--mkt-text-muted)]">
          Built for rooms that stay live
        </p>
        <h2 className="mt-2 text-balance text-center font-heading text-3xl font-bold tracking-tight text-[var(--mkt-text)]">
          Chat, collab, and broadcast on one kernel
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-center text-[var(--mkt-text-muted)]">
          Same Durable Object room for messages, presence, and server events. Photos are product scenes, not a second stack.
        </p>
        <div className="mt-10">
          <AccordionGallery
            items={GALLERY_ITEMS}
            accentColor="#C2410C"
            overlayColor="#1c1917"
            textColor="#fafaf9"
            height={440}
            grayscale={false}
            trigger="hover"
          />
        </div>
      </div>
    </section>
  );
}
