import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Notifications — FluxyChat",
  description:
    "In-app alerts for mentions and DMs, offline SMS preferences, digest and quiet hours settings.",
  path: "/notifications",
});

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
