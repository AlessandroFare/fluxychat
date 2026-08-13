import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Moderation: FluxyChat",
  description:
    "Mute, ban, announcements, reports queue, audit events, and webhook management for project admins.",
  path: "/admin",
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
