# portalsdk

Monorepo for Portal's client SDK. It is a single pnpm workspace containing three
independently versioned, independently published npm packages: a dependency-free wire
protocol layer, a runtime core built on top of it, and React bindings on top of the core.
Each package builds, tests, versions, and ships on its own — there is no lockstep
versioning, so a patch to the React bindings never forces a release of the core.

## Packages

| Package | Description |
| --- | --- |
| [`@portalsdk/wire-protocol`](packages/wire-protocol) | Wire format types and codecs for the Portal protocol. Zero runtime dependencies. |
| [`@portalsdk/core`](packages/core) | Transport-agnostic Portal client runtime, built on the wire protocol over a WebSocket. |
| [`@portalsdk/react`](packages/react) | React bindings — hooks and providers wrapping the Portal core client. |

## Development

```bash
pnpm install
pnpm build       # build all packages
pnpm test        # run all package test suites
pnpm typecheck   # type-check all packages
pnpm lint        # lint all packages
```

Every script also runs per package:

```bash
pnpm --filter @portalsdk/core build
pnpm --filter @portalsdk/react test
```

## Status

Scaffolding only. Each package currently exports a `VERSION` constant and nothing else;
protocol types and SDK logic land in follow-up work.

## Publishing

Publish with **pnpm**, never `npm publish`. Cross-package deps are declared as
`workspace:^`, and only pnpm rewrites that to a real semver range (`^0.0.0`) in the
published manifest — `npm publish` would ship the literal `workspace:^` and every install
would break.

```bash
pnpm --filter @portalsdk/core publish
```

Each package carries its own version and is released on its own; bumping one never
requires bumping the others.

## TODO

- **Release tooling** — no changesets or release automation yet. Packages are published
  manually and must stay independently versioned when it is added.
- **CI** — no continuous integration yet. Needs install/build/test/typecheck on PRs, plus
  a publish workflow with npm provenance (see the note in `.npmrc`).

## License

[MIT](LICENSE)
