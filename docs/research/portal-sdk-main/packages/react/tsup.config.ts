import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  // Marks the RSC client boundary. This banner is the only source of the directive —
  // src/index.ts deliberately omits it, otherwise it lands in dist twice.
  // NOTE: do not enable `treeshake` here — its rollup pass drops banner directives,
  // silently stripping "use client" from dist. Guarded by src/use-client.test.ts.
  banner: { js: '"use client";' },
  // react is a peer dep and core is a runtime dep: neither may be inlined.
  external: ["react", "@portalsdk/core"],
});
