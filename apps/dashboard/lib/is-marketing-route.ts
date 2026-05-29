import { MARKETING_PATH_PREFIXES } from "@/lib/hosted-product";

/** Routes that render their own nav or should not show the global layout Header. */
export function isMarketingRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return MARKETING_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
