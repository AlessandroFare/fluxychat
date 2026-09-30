import type { Metadata } from "next";

function docsBaseUrl(): URL {
  const fromEnv = process.env.NEXT_PUBLIC_DOCS_URL?.trim();
  if (fromEnv) return new URL(fromEnv);
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    return new URL("https://docs.fluxychat.com");
  }
  return new URL("http://localhost:3001");
}

export const baseUrl = docsBaseUrl();

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
