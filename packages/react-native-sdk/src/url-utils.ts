export function trimTrailingSlashes(url: string): string {
  let out = url;
  while (out.endsWith('/')) out = out.slice(0, -1);
  return out;
}
