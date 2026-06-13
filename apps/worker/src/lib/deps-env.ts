/** Extract Worker env from route deps bag or legacy raw env argument. */
export function depsEnv(h: { env?: unknown } | unknown): unknown {
  if (h && typeof h === "object" && "env" in h) {
    return (h as { env?: unknown }).env ?? h;
  }
  return h;
}
