# FluxyChat worker — D1 database

Migrations live in this directory (`0001_*.sql` … `0136_*.sql`). Wrangler applies them in filename order via `migrations_dir = "db"` in `wrangler.toml`.

## Existing environments (production / staging)

Always use incremental migrations — **do not** replace the live schema with the baseline file.

```bash
cd apps/worker
wrangler d1 migrations list fluxychat --remote
wrangler d1 migrations apply fluxychat --remote
```

## Greenfield / local dev

**Option A — migrations (default)**  
Same as production: apply all files in order.

```bash
wrangler d1 migrations apply fluxychat --local
```

**Option B — baseline snapshot (faster)**  
After Phase 2 consolidation, import `baseline/0136_schema.sql` on an empty database, then stamp migration state so Wrangler skips 0001–0136. Only use on **new** databases; never on DBs that already ran migrations.

```bash
wrangler d1 execute fluxychat --local --file=db/baseline/0136_schema.sql
# Stamp: record 0136 as applied (exact command depends on your wrangler version / workflow)
```

Regenerate the baseline after adding migration `0137+`:

```bash
wrangler d1 migrations apply fluxychat --local
pnpm run db:export-baseline
```

## Baseline contents

| File | Description |
|------|-------------|
| `baseline/0136_schema.sql` | Schema-only export after migration 0136 (regenerate after each schema release) |

**Note:** Migrations `0132`, `0135`, and `0136` rename legacy P15/P18 tables (`0084` replay, `0121` workflow builder, `0081` identity SAML) before creating expanded schemas. If a local DB failed mid-apply, reset local D1 or delete `.wrangler/state` and re-apply.

See [`docs/operations/d1-schema-consolidation.md`](../../docs/operations/d1-schema-consolidation.md) for the full consolidation plan.

## Verify schema

```bash
wrangler d1 execute fluxychat --local --command "SELECT COUNT(*) AS tables FROM sqlite_master WHERE type='table'"
```

Expect **100+** tables after 0136 (exact count grows with feature migrations).

