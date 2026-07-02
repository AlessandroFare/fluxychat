import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind class merge utility — identical to the one used in shadcn projects.
 * `packages/ui` keeps its own copy so it never depends on a consumer's `@/lib/utils`.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
