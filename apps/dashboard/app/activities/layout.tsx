import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Activities — FluxyChat",
  description:
    "Recent webhooks, agent runs, and automation events for your project.",
  path: "/activities",
});

export default function ActivitiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
