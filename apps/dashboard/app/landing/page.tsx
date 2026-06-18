import type { Metadata } from "next";
import { PAGE_METADATA } from "@/lib/marketing-copy";
import { CloudflareCostTable } from "~/components/marketing/cloudflare-cost-table";
import { LandingCompareSection } from "./landing-compare-section";
import { LandingEnterpriseSection } from "./landing-enterprise-section";
import { LandingFaqSection } from "./landing-faq-section";
import { LandingFeaturesClient } from "./landing-features-client";
import { LandingFinalCtaSection } from "./landing-final-cta-section";
import { LandingFooter } from "./landing-footer";
import { LandingHeroClient } from "./landing-hero-client";
import { LandingLifecycleSection } from "./landing-lifecycle-section";
import { LandingLogoStrip } from "./landing-logo-strip";
import { LandingPricingSection } from "./landing-pricing-section";
import { LandingShell } from "./landing-shell";
import { LandingStatsSection } from "./landing-stats-section";

export const metadata: Metadata = PAGE_METADATA.landing;

/** Server-orchestrated landing — static sections are RSC; interactive blocks are client islands (ENG-13). */
export default function LandingPage() {
  return (
    <LandingShell>
      <LandingHeroClient />
      <LandingLogoStrip />
      <LandingStatsSection />
      <LandingFeaturesClient />
      <LandingEnterpriseSection />
      <LandingPricingSection />
      <LandingLifecycleSection />
      <LandingCompareSection />
      <section
        id="cloudflare-cost"
        className="scroll-mt-20 border-b border-white/10 bg-slate-950 px-4 py-20 sm:px-6"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-white">
            What does it actually cost on Cloudflare?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-300">
            Real numbers, not vague &quot;contact sales&quot; ranges. The free tier is
            generous; the paid tier scales with usage; self-host is just your
            Cloudflare bill.
          </p>
          <div className="mt-10">
            <CloudflareCostTable />
          </div>
        </div>
      </section>
      <LandingFaqSection />
      <LandingFinalCtaSection />
      <LandingFooter />
    </LandingShell>
  );
}

