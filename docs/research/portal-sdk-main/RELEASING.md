# Releasing

Cross-package dependencies in this workspace use the `workspace:^` protocol (e.g.
`@portalsdk/core` depends on `@portalsdk/wire-protocol` via `workspace:^`). That's
correct for local development — it always links the in-repo package.

**Releases must use `pnpm publish`, never `npm publish`.**

`pnpm publish` rewrites `workspace:` ranges to real semver ranges (e.g.
`workspace:^` → `^0.3.0`) when it packs the tarball. `npm publish` does not
understand the `workspace:` protocol at all and ships the literal string through —
which produces a package that is uninstallable by anyone outside this workspace
(`ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`). This is exactly what happened to the
`@portalsdk/core@0.1.0`/`0.1.1` and `@portalsdk/react@0.1.0` releases.

Every publishable package has a `prepublishOnly` script
(`scripts/verify-publish-manifest.mjs`) that refuses to proceed unless it's running
under `pnpm publish` and the packed manifest is free of `workspace:` ranges, so this
mistake should now be caught automatically. Don't work around or remove that guard.

## Release steps

From the repo root, with a clean working tree on `main`:

1. Bump the `version` field in the package(s) you're releasing.
2. `pnpm build`
3. Publish leaf-first, i.e. publish a package's own dependencies before the package
   itself, so consumers can always resolve a satisfying version:
   ```
   cd packages/wire-protocol && pnpm publish
   cd packages/core && pnpm publish
   cd packages/react && pnpm publish
   ```
   (Only publish the packages that actually changed.)
4. Verify from outside the workspace: in a scratch directory, `npm init -y && npm i
   @portalsdk/core @portalsdk/react` should succeed and resolve
   `@portalsdk/wire-protocol` from the registry.
5. Commit the version bump(s) and open a PR.

If a broken version ever gets published anyway, deprecate it immediately:

```
npm deprecate @portalsdk/<pkg>@<version> "broken dependency ranges; use latest"
```
