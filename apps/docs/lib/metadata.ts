import type { Metadata } from "next";

function docsBaseUrl(): URL {
  const fromEnv = process.env.NEXT_PUBLIC_DOCS_URL?.trim();
  if (fromEnv && !/localhost|127\.0\.0\.1/i.test(fromEnv)) return new URL(fromEnv);
  if (process.env.NODE_ENV === "development" && !process.env.VERCEL && !process.env.CF_PAGES) {
    return new URL("http://localhost:3001");
  }
  return new URL("https://docs.fluxychat.com");
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
