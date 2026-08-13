import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Inbox: FluxyChat",
  description:
    "Mentions, unread rooms, snoozed channels, and follow-ups across your project.",
  path: "/inbox",
});

export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return children;
}
