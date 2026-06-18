import type { MetadataRoute } from "next";

/**
 * Sitemap for Fluxychat. The marketing site + the console are served
 * from the same dashboard origin; for SEO purposes we surface the
 * publicly indexable marketing pages only. The console is gated by
 * Clerk + the /enter acknowledgement flow, so we exclude it.
 *
 * Update the `lastModified` field below when you ship material copy
 * changes  search engines reward accurate mtimes.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const marketing = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://fluxychat.com";
  return [
    { url: `${marketing}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${marketing}/landing`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${marketing}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${marketing}/compare`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${marketing}/get-started`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${marketing}/docs`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${marketing}/guides`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${marketing}/why`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${marketing}/features`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${marketing}/status`, lastModified: now, changeFrequency: "daily", priority: 0.4 },
  ];
}
