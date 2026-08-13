import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Billing & usage: FluxyChat",
  description:
    "Plan, monthly usage counters, Stripe checkout, and plan comparison for your project.",
  path: "/billing",
});

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
