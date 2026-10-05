import type { Metadata } from "next";
import Link from "next/link";
import { PAGE_METADATA } from "@/lib/marketing-copy";
import { HOSTED_PATHS, docsSiteHref } from "@/lib/hosted-product";
import { CloudflareCostTable } from "~/components/marketing/cloudflare-cost-table";
import { LandingCompareSection } from "./landing-compare-section";
import { LandingEnterpriseSection } from "./landing-enterprise-section";
import { LandingFaqSection } from "./landing-faq-section";
import { LandingFeaturesClient } from "./landing-features-client";
import { LandingFinalCtaSection } from "./landing-final-cta-section";
import { LandingFooter } from "./landing-footer";
import { LandingDemoSection } from "./landing-demo-section";
import { LandingBuildGallery, HOMEPAGE_EXAMPLES } from "./landing-build-gallery";
import { LandingHeroClient } from "./landing-hero-client";
import { LandingLifecycleSection } from "./landing-lifecycle-section";
import { LandingLogoStrip } from "./landing-logo-strip";
import { LandingPricingSection } from "./landing-pricing-section";
import { LandingRealtimeSection } from "./landing-realtime-section";
import { LandingCollabSection } from "./landing-collab-section";
import { LandingShell } from "./landing-shell";
import { LandingStatsSection } from "./landing-stats-section";
import { LandingWhatsNewSection } from "./landing-whats-new-section";
import { LandingBand } from "./landing-band";
import { LandingPinBar } from "./landing-pin-bar";
import { LandingMediaStrip } from "./landing-media-strip";

export const metadata: Metadata = PAGE_METADATA.landing;

/** Server-orchestrated landing — grouped dark/light bands over the signal field. */
export default function LandingHomePage() {
  return (
    <LandingShell>
      <LandingHeroClient />

      <LandingBand tone="glass">
        <LandingDemoSection />
        <LandingBuildGallery
          examples={HOMEPAGE_EXAMPLES}
          heading="One room, humans and an agent"
          subhead="Same Durable Object. Pick a scaffold and copy the command."
        />
      </LandingBand>

      <LandingBand tone="light">
        <LandingLogoStrip />
        <LandingStatsSection />
        <LandingMediaStrip />
      </LandingBand>

      <LandingBand tone="dark">
        <LandingFeaturesClient />
      </LandingBand>

      <LandingBand tone="light">
        <LandingWhatsNewSection />
      </LandingBand>

      <LandingBand tone="glass" reveal={false}>
        <div className="mkt-pin">
          <div className="px-4 pt-8 sm:px-6">
            <LandingPinBar />
          </div>
          <LandingRealtimeSection />
          <LandingCollabSection />
        </div>
        <p className="px-4 pb-8 text-center text-sm text-slate-400 sm:px-6">
          Stream, IoT, fleet, and game overlays are on{" "}
          <Link href={HOSTED_PATHS.labs} className="underline underline-offset-2 hover:text-white">
            /labs
          </Link>
          .
        </p>
      </LandingBand>

      <LandingBand tone="light">
        <LandingEnterpriseSection />
        <LandingCompareSection />
      </LandingBand>

      <LandingBand tone="dark">
        <LandingPricingSection />
      </LandingBand>

      <LandingBand tone="light">
        <LandingLifecycleSection />
        <LandingFaqSection />
      </LandingBand>

      <LandingBand tone="glass">
        <section
          id="cloudflare-cost"
          className="scroll-mt-20 border-b border-white/10 px-4 py-20 sm:px-6"
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="text-balance text-center font-heading text-3xl font-bold tracking-tight text-white">
              What does it actually cost on Cloudflare?
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-pretty text-center text-zinc-300">
              Estimate only. Cloudflare&apos;s chat Durable Object sample was dominated by
              <strong className="font-medium text-white"> duration</strong>, not request count.
              We have not published idle-socket duration from a real invoice. See{" "}
              <Link href={docsSiteHref("learn/status-and-limits")} className="underline underline-offset-2 hover:text-white">
                Status and limits
              </Link>
              .
            </p>
            <div className="mt-10">
              <CloudflareCostTable variant="dark" />
            </div>
          </div>
        </section>
        <LandingFinalCtaSection />
        <LandingFooter />
      </LandingBand>
    </LandingShell>
  );
}
