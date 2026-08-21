"use client";

import Link from "next/link";
import {
  Boxes,
  Gamepad2,
  MessageSquare,
  Mic,
  Pen,
  Radio,
  Truck,
  Video,
} from "lucide-react";
import { SpotlightCard } from "~/components/marketing/spotlight-card";
import { ReadinessBadge, ReadinessLinkRow } from "~/components/ui/readiness-badge";
import { listIndustryReadiness, listProductReadiness } from "@/lib/readiness-display";

const PLATFORM_PRIMITIVES = [
  { title: "Room kernel", body: "One WebSocket per room: messages, presence, client events, and server_event fan-out for polls, breakouts, and live stage." },
  { title: "Capability layer", body: "Attach polls, whiteboard, attendance, market data, or device shadow without standing up a second realtime backend." },
  { title: "Policy + audit", body: "RBAC, retention, consent gates, and signed event envelopes enforced on the worker before data leaves the room." },
  { title: "Honest readiness", body: "Chat is production. Verticals are labeled labs or preview so the catalog matches what the console actually promotes." },
] as const;

const PRODUCT_ICONS = {
  chat: MessageSquare,
  collab: Pen,
  stream: Video,
  voice: Mic,
  game: Gamepad2,
  iot: Radio,
  fleet: Truck,
  spatial: Boxes,
} as const;

export function LandingPlatformSection() {
  const products = listProductReadiness();
  const industries = listIndustryReadiness();

  return (
    <section id="platform" className="scroll-mt-20 border-b border-white/10 bg-[#0b0b0c] px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase text-zinc-500">One room primitive, many products</p>
          <h2 className="mt-3 text-balance font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Chat stays the core. The platform grows around it.
          </h2>
          <p className="mt-4 text-pretty text-lg text-zinc-400">
            Chat is the core. The same room kernel runs classrooms, care teams, live venues, and trading desks. Voice, stream, collab, and industry modules plug in with labeled readiness.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLATFORM_PRIMITIVES.map((item) => (
            <SpotlightCard key={item.title} className="border-white/10 bg-[#121214] p-5" spotlightColor="rgba(255, 106, 26, 0.14)">
              <h3 className="font-heading text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-pretty text-sm leading-6 text-zinc-400">{item.body}</p>
            </SpotlightCard>
          ))}
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <div>
            <h3 className="font-heading text-xl font-semibold text-white">Product suite</h3>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {products.map((entry) => {
                const Icon = PRODUCT_ICONS[entry.id as keyof typeof PRODUCT_ICONS] ?? MessageSquare;
                return (
                  <Link key={entry.id} href={entry.href} className="am-focus flex items-center justify-between rounded-xl border border-white/10 bg-[#121214] px-4 py-3 transition hover:border-white/20">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-100">
                      <Icon className="size-4" aria-hidden />
                      {entry.label}
                    </span>
                    <ReadinessBadge label={entry.readinessLabel} />
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-heading text-xl font-semibold text-white">Industry solutions</h3>
            <div className="mt-4 grid gap-2">
              {industries.map((entry) => (
                <ReadinessLinkRow key={entry.id} entry={entry} highlight={entry.id === "edu"} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
