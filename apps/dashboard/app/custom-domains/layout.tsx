import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Custom domains — FluxyChat",
  description:
    "Map chat.yourcompany.com to your project with Cloudflare for SaaS and managed TLS.",
  path: "/custom-domains",
});

export default function CustomDomainsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
