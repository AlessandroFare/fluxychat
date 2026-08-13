# FluxyChat documentation site

Fumadocs site published at [docs.fluxychat.com](https://docs.fluxychat.com).

## Local dev

From the repo root:

```bash
pnpm install
pnpm docs:dev
```

Content lives in `content/docs/**/*.mdx`. Navigation is controlled by `content/docs/**/meta.json`.

## Relationship to repo docs

- **Public docs** (this app): integrator-facing guides and API reference.
- **Repo docs** (`../../docs/`): contributor notes, runbooks, and research clones.

Do not duplicate internal roadmaps or audit reports in public MDX. Stubs in `content/docs/architecture/` and `content/docs/audit/` redirect readers to public guides.

## Related

- [Root README](../../README.md)
- [Dashboard README](../dashboard/README.md)
