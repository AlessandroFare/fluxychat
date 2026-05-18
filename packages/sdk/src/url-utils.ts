/** Strip trailing slashes without regex (avoids ReDoS on hostile URLs). */
export function trimTrailingSlashes(url: string): string {
  let out = url;
  while (out.endsWith("/")) out = out.slice(0, -1);
  return out;
}
