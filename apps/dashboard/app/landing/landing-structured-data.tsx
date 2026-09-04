import { LANDING_FAQ } from "@/lib/marketing-faq";
import { SITE_DESCRIPTION } from "@/lib/marketing-copy";

const SITE_URL = "https://fluxychat.com";

export function LandingStructuredData() {
  const payload = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "FluxyChat",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Cloudflare Workers",
        license: "https://opensource.org/licenses/MIT",
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description:
            "Free hosted tier: 200000 persisted messages per month, no credit card. Hosted is open beta.",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: LANDING_FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.a,
          },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
