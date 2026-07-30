output "name_prefix" {
  value       = local.name_prefix
  description = "Prefix for Cloudflare resources"
}

output "worker_script_name" {
  value = var.worker_script_name
}

output "d1_binding" {
  value = local.d1_binding
}

output "d1_database_name" {
  value = var.d1_database_name
}

output "kv_binding" {
  value = local.kv_binding
}

output "deploy_command" {
  value = "pnpm --filter worker deploy"
}

output "health_check_url" {
  value = "https://${var.worker_script_name}.${var.cloudflare_account_id}.workers.dev/health"
}
