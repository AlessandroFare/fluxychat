terraform {
  required_version = ">= 1.5.0"
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  d1_binding  = "DB"
  kv_binding  = "KV"
}

# Cloudflare provider wiring is optional — many teams deploy Worker via wrangler only.
# Uncomment when you add cloudflare/cloudflare to required_providers:
#
# resource "cloudflare_workers_script" "fluxychat" {
#   account_id = var.cloudflare_account_id
#   name       = var.worker_script_name
#   content    = file("${path.module}/../../../apps/worker/dist/index.js")
# }

resource "null_resource" "d1_migrations" {
  count = var.run_migrations_on_apply ? 1 : 0

  triggers = {
    database = var.d1_database_name
  }

  provisioner "local-exec" {
    working_dir = abspath("${path.module}/../../..")
    command     = "pnpm exec wrangler d1 migrations apply ${var.d1_database_name} --local=false"
  }
}
