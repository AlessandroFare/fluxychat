/** Strip trailing `/` without `/+$` (CodeQL ReDoS). */
export function trimTrailingSlashes(url) {
  let out = String(url || "");
  while (out.endsWith("/")) out = out.slice(0, -1);
  return out;
}
