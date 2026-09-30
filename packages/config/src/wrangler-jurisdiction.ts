/**
 * Cloudflare Wrangler: `jurisdiction = "eu"` on Durable Object bindings.
 * D1 region is chosen when you create the database — this helper does not move D1.
 * Hosted SaaS does not apply this from a dashboard toggle.
 */
export function applyWranglerDoJurisdiction(
  toml: string,
  jurisdiction: "eu" | undefined | null,
): string {
  const parts = toml.split("[[durable_objects.bindings]]");
  if (parts.length === 1) return toml;
  const wantEu = jurisdiction === "eu";
  return [
    parts[0],
    ...parts.slice(1).map((part) => {
      let body = part.replace(/\njurisdiction\s*=\s*"[^"]+"\s*/g, "\n");
      if (wantEu && /class_name\s*=/.test(body) && !/\njurisdiction\s*=/.test(body)) {
        body = body.replace(/(class_name\s*=\s*"[^"]+")/, `$1\njurisdiction = "eu"`);
      }
      return `[[durable_objects.bindings]]${body}`;
    }),
  ].join("");
}
