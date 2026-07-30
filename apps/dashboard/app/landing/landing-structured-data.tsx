import { PLATFORM_READINESS } from "@fluxy-chat/sdk";

const SITE_URL = "https://fluxychat.com";

export function LandingStructuredData() {
  const industries = Object.entries(PLATFORM_READINESS)
    .filter(([id]) => ["edu", "health", "event", "finance", "continuity"].includes(id))
    .map(([, entry]) => ({
      "@type": "SoftwareApplication",
      name: entry.label,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: `${SITE_URL}${entry.href}`,
      description: entry.description,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: `${entry.readiness} — transparent readiness, not implied production certification`,
      },
    }));

  const payload = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "FluxyChat",
        applicationCategory: "DeveloperApplication",
        operatingSystem: "Web, Cloudflare Workers",
        description:
          "Realtime interaction platform: one room primitive for chat, collaboration, streaming, game backends, IoT and industry verticals.",
        url: SITE_URL,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      ...industries,
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
