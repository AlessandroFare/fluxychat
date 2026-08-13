import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Embed widget: FluxyChat",
  description:
    "Add a chat bubble to any site with one script tag. Configure origin allowlist, theme, and launcher.",
  path: "/embed",
});

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
