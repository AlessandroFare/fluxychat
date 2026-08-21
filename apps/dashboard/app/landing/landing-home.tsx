import type { Metadata } from "next";
import { PAGE_METADATA } from "@/lib/marketing-copy";
import { CloudflareCostTable } from "~/components/marketing/cloudflare-cost-table";
import { LandingCompareSection } from "./landing-compare-section";
import { LandingEnterpriseSection } from "./landing-enterprise-section";
import { LandingFaqSection } from "./landing-faq-section";
import { LandingFeaturesClient } from "./landing-features-client";
import { LandingFinalCtaSection } from "./landing-final-cta-section";
import { LandingFooter } from "./landing-footer";
import { LandingDemoSection } from "./landing-demo-section";
import { LandingHeroClient } from "./landing-hero-client";
import { LandingLifecycleSection } from "./landing-lifecycle-section";
import { LandingLogoStrip } from "./landing-logo-strip";
import { LandingPricingSection } from "./landing-pricing-section";
import { LandingRealtimeSection } from "./landing-realtime-section";
import { LandingCollabSection } from "./landing-collab-section";
import { LandingStreamSection } from "./landing-stream-section";
import { LandingShell } from "./landing-shell";
import { LandingStatsSection } from "./landing-stats-section";
import { LandingWhatsNewSection } from "./landing-whats-new-section";
import { LandingBand } from "./landing-band";
import { LandingMediaStrip } from "./landing-media-strip";

export const metadata: Metadata = PAGE_METADATA.landing;

/** Server-orchestrated landing — grouped dark/light bands over the signal field. */
export default function LandingHomePage() {
  return (
    <LandingShell>
      <LandingHeroClient />

      <LandingBand tone="glass">
        <LandingDemoSection />
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

      <LandingBand tone="glass">
        <LandingRealtimeSection />
        <LandingCollabSection />
        <LandingStreamSection />
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
              Real numbers, not vague &quot;contact sales&quot; ranges. The free tier is
              generous; the paid tier scales with usage; self-host is just your
              Cloudflare bill. No per-connection pricing surprises.
            </p>
            <div className="mt-10">
              <CloudflareCostTable />
            </div>
          </div>
        </section>
        <LandingFinalCtaSection />
        <LandingFooter />
      </LandingBand>
    </LandingShell>
  );
}
