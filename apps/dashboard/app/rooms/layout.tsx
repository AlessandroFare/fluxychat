import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Rooms — FluxyChat",
  description:
    "Create, rename, delete rooms. Manage members, health, scheduled messages, and offline notifications.",
  path: "/rooms",
});

export default function RoomsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
