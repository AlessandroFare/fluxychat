/**
 * Platform operator detection for hosted SaaS console (matches Worker FLUXY_PLATFORM_PROJECT_ID).
 */

function parsePlatformProjectIds(raw: string | undefined): string[] {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Server-side: FLUXY_PLATFORM_PROJECT_ID (and optional NEXT_PUBLIC mirror). */
export function getPlatformProjectIds(): string[] {
  return parsePlatformProjectIds(
    process.env.FLUXY_PLATFORM_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FLUXY_PLATFORM_PROJECT_ID,
  );
}

/** Client-safe when NEXT_PUBLIC_FLUXY_PLATFORM_PROJECT_ID is set on Vercel. */
export function getPublicPlatformProjectIds(): string[] {
  return parsePlatformProjectIds(process.env.NEXT_PUBLIC_FLUXY_PLATFORM_PROJECT_ID);
}

export function isPlatformOperatorProjectId(projectId: string | null | undefined): boolean {
  if (!projectId) return false;
  const ids = getPublicPlatformProjectIds();
  if (ids.length === 0) return false;
  return ids.includes(projectId);
}
