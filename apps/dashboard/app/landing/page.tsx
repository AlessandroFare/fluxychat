import type { Metadata } from "next";
import { PAGE_METADATA } from "@/lib/marketing-copy";
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
      <LandingFaqSection />
      <LandingFinalCtaSection />
      <LandingFooter />
    </LandingShell>
  );
}
