import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Agent queue — FluxyChat",
  description:
    "Claim rooms, track SLA timers, and resolve handoffs between human agents and bots.",
  path: "/agent-queue",
});

export default function AgentQueueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
