import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Settings: FluxyChat",
  description:
    "Account, project, and notification preferences. Links to profile, API keys, notifications, and admin.",
  path: "/settings",
});

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
