import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fluxychat - Developer Conference Slides",
  description: "Realtime that feels like serverless. Edge-native in-app chat with Cloudflare Workers, Durable Objects, and D1.",
};

export default function SlidesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Slides page has its own minimal layout - no header, no console chrome
  return children;
}
