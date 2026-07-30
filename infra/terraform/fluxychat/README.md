# FluxyChat Terraform module (starter)

Build-first IaC for self-hosted FluxyChat on Cloudflare. This module documents required bindings and outputs wrangler-style names; it does **not** replace `wrangler deploy` until you wire a Cloudflare provider token.

## What it manages today

- Local variables for project name, environment, and D1/KV/R2 binding names
- Optional `null_resource` hook to run migrations via `pnpm wrangler d1 migrations apply`
- Outputs you can feed to CI or Pulumi

## Prerequisites

- [Terraform](https://www.terraform.io/) >= 1.5
- Cloudflare account with Workers, D1, KV, R2 enabled
- `wrangler` authenticated (`wrangler login`)

## Quick start

```bash
cd infra/terraform/fluxychat
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars
terraform init
terraform plan
```

Deploy the Worker itself with the repo root:

```bash
pnpm --filter worker deploy
```

Use `terraform output` for binding names when configuring GitHub Actions secrets.

## Roadmap (MD-6)

- Official `fluxychat` provider with `fluxychat_project`, `fluxychat_webhook`, `fluxychat_room` resources
- Pulumi package mirroring the same schema

See [Self-host one command](/docs/guides/self-host-one-command) for the manual path.

For **`fluxychat_project`** Terraform resources, see [`terraform/providers/fluxychat`](../../terraform/providers/fluxychat) and [Terraform IaC guide](/docs/guides/enterprise/terraform-iac).
