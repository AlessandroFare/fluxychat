variable "project_name" {
  type        = string
  description = "FluxyChat project slug used in resource names"
}

variable "environment" {
  type        = string
  description = "Environment label (dev, staging, prod)"
  default     = "dev"
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID for Workers/D1"
}

variable "d1_database_name" {
  type        = string
  description = "D1 database name bound to the worker"
  default     = "fluxychat-db"
}

variable "kv_namespace_title" {
  type        = string
  description = "Human-readable KV namespace title"
  default     = "fluxychat-kv"
}

variable "run_migrations_on_apply" {
  type        = bool
  description = "When true, runs D1 migrations via local wrangler after plan (requires wrangler on PATH)"
  default     = false
}

variable "worker_script_name" {
  type        = string
  description = "Cloudflare Worker script name"
  default     = "fluxychat-worker"
}
