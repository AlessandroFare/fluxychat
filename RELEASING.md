# Releasing

GitHub Releases and Packages are empty until someone cuts a tag. Do not invent a 1.0.

Current pins (also in `docs/product-facts.json`):

- `@fluxy-chat/protocol` 0.1.7
- `@fluxy-chat/sdk` 0.6.15
- `@fluxy-chat/react` 0.1.9
- `@fluxy-chat/vue` 0.1.4
- `@fluxy-chat/svelte` 0.1.2
- `@fluxy-chat/ui` 0.1.8
- `@fluxy-chat/ui-kit` 0.1.9
- `@fluxy-chat/create-fluxy-chat` 0.5.25
- `@fluxy-chat/agent` 0.2.1 (skip this cut unless the package changed)

Tag from the package version you actually published, then paste the changelog from `packages/*/CHANGELOG.md`.

```bash
cd packages/sdk && pnpm run build && pnpm test
npm login && npm publish --access public
```

Pre-1.0: breaking changes can land without a major bump. Prefer a changelog note. `/agents` is the public HTTP path; `/bots` stays for old clients.
