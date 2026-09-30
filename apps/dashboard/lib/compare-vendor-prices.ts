/**
 * Public list prices for compare pages. Re-check the vendor URLs before a sales call.
 * Captured 30 Sep 2026. Do not invent agent SKUs that are not on these pages.
 */

export const COMPARE_PRICE_AS_OF = "30 Sep 2026";

export const SENDBIRD_CHAT_PRICES = {
  sourceUrl: "https://sendbird.com/pricing/chat",
  asOf: COMPARE_PRICE_AS_OF,
  rows: [
    {
      plan: "Free trial / Developer-style",
      list: "Free. Soft cap around 100 MAU / 10 peak connections on their marketing copy.",
    },
    {
      plan: "Starter 5K MAU",
      list: "$349/month billed annually, or $399/month billed monthly. Overages may apply.",
    },
    {
      plan: "Pro 5K MAU",
      list: "$499/month billed annually, or $599/month billed monthly. Overages may apply.",
    },
    {
      plan: "Enterprise",
      list: "Custom. They market this as millions of MAU.",
    },
  ],
  mauNote:
    "A MAU is a user who connected with the Client SDK in the last 30 days (Sendbird FAQ on that pricing page).",
  agentNote:
    "Chat pricing does not list an Agent / Delight SKU. We do not invent one.",
} as const;

export const COMETCHAT_PRICES = {
  chatSourceUrl: "https://www.cometchat.com/pricing.md",
  chatVerifiedOnPage: "2026-05-20",
  asOf: COMPARE_PRICE_AS_OF,
  chatYearlyRows: [
    { mau: "1k", basic: "$239", advanced: "$359", enterprise: "Starts from 10k MAU" },
    { mau: "10k", basic: "$299", advanced: "$399", enterprise: "$999" },
    { mau: "25k", basic: "$699", advanced: "$949", enterprise: "Get in touch" },
  ],
  chatNote:
    "Yearly billing, shown as monthly equivalent, billed annually. From their LLM pricing.md dump of the Storyblok payload.",
  agentRows: [
    {
      plan: "Web-only",
      list: "$0/month plus pay-as-you-go credit bundles. 1,000 starter credits. Bundles from $25.",
    },
    {
      plan: "Core",
      list: "$123.75/month, or $99/month billed annually. 2,500 credits/month.",
    },
    {
      plan: "Plus",
      list: "$1,248.75/month, or $999/month billed annually. 25,000 credits/month.",
    },
  ],
  extraCredits: "$25 per 2,500 extra credits on Core/Plus (same pricing.md).",
} as const;
