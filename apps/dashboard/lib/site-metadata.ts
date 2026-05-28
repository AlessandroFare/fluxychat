import type { Metadata } from "next";

const SITE_NAME = "Fluxychat";

/** Public site origin for canonical URLs and OG tags. Set in production. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://fluxychat.com"
).replace(/\/$/, "");

const DEFAULT_OG_IMAGE = `${SITE_URL}/fluxychat-icon.svg`;

interface PageMetadataInput {
  /** Short page title (layout template adds " · Fluxychat" unless absoluteTitle is set). */
  title: string;
  description: string;
  /** Path only, e.g. "/landing". */
  path?: string;
  /** Use when the title already includes the brand or must not use the template. */
  absoluteTitle?: boolean;
  /** Set false for console routes you do not want indexed. */
  index?: boolean;
}

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const { title, description, path, absoluteTitle, index = true } = input;
  const url = path ? `${SITE_URL}${path}` : SITE_URL;
  const resolvedTitle = absoluteTitle ? { absolute: title } : title;

  return {
    title: resolvedTitle,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: path ? { canonical: url } : undefined,
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: "website",
      locale: "en_GB",
      url,
      siteName: SITE_NAME,
      title,
      description,
      images: [{ url: DEFAULT_OG_IMAGE, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export const ROOT_METADATA: Metadata = {
  ...buildPageMetadata({
    title: SITE_NAME,
    description:
      "Realtime in-app chat on the edge. SDK, AI agents, and operator console for Cloudflare Workers.",
    absoluteTitle: true,
  }),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
};
