import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata } from "@/lib/site-metadata";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { LandingShell } from "../landing/landing-shell";
import { LandingBand } from "../landing/landing-band";
import { LandingStreamSection } from "../landing/landing-stream-section";
import { LandingBuildGallery } from "../landing/landing-build-gallery";
import { LandingFooter } from "../landing/landing-footer";

export const metadata: Metadata = buildPageMetadata({
  title: "Labs: stream, game, IoT, fleet",
  description:
    "Stream, game, IoT, and fleet sit on the same room. Chat, presence, Yjs, and invokeAgent are the product.",
  path: "/labs",
});

export default function LabsPage() {
  return (
    <LandingShell>
      <LandingBand tone="dark">
        <section className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Labs</p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight text-white">Off the main nav</h1>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Stream overlays, game ticks, IoT ingest, and fleet GPS sit on the same
            room Durable Object. They are optional. Chat, presence, Yjs, and invokeAgent are the product.
            We don't sell healthcare. There is no BAA. Voice is transcripts in the room, not an SFU.
          </p>
          <p className="mt-4 text-sm text-slate-400">
            <Link href={HOSTED_PATHS.landing} className="underline underline-offset-2 hover:text-white">
              Back to home
            </Link>
            {" · "}
            <Link href={HOSTED_PATHS.docs} className="underline underline-offset-2 hover:text-white">
              Docs
            </Link>
          </p>
        </section>
        <LandingStreamSection />
        <LandingBuildGallery
          heading="Pick a scaffold"
          subhead="Live cursors, war room, device panel, deal room. You need a Worker URL and a room first."
        />
      </LandingBand>
      <LandingBand tone="glass">
        <LandingFooter />
      </LandingBand>
    </LandingShell>
  );
}
