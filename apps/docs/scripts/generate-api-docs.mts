/**
 * Legacy MDX generator — API pages now come from openapi.staticSource() in lib/source.ts.
 * Run `pnpm build` after editing openapi.docs.yaml.
 */
console.log(
  "API pages are generated at build time via openapi.staticSource() in lib/source.ts.",
);
console.log("Edit apps/docs/openapi.docs.yaml, then run: pnpm --filter docs build");
