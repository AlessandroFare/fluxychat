import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Conversation Transcripts: FluxyChat",
  description: "Per-user message persistence keyed by cross-platform identity. Append, list, filter, and delete with configurable retention.",
  path: "/transcripts",
});

export default function TranscriptsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
