import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Features — FluxyChat",
  description:
    "AI agents, omnichannel inbox, enterprise compliance, embed widget, and integrations in FluxyChat.",
  path: "/features",
});

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
