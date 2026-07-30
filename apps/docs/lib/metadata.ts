import type { Metadata } from "next";

export const baseUrl = new URL(process.env.NEXT_PUBLIC_DOCS_URL || "http://localhost:3001");

export function createMetadata(override: Metadata): Metadata {
  return {
    ...override,
    openGraph: {
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      url: baseUrl,
      siteName: "FluxyChat Docs",
      ...override.openGraph,
    },
    twitter: {
      card: "summary_large_image",
      title: override.title ?? undefined,
      description: override.description ?? undefined,
      ...override.twitter,
    },
  };
}
