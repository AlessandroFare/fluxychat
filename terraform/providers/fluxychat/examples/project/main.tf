variable "worker_url" {
  type        = string
  description = "FluxyChat Worker base URL"
}

variable "admin_jwt" {
  type        = string
  sensitive   = true
  description = "Admin JWT for project provisioning"
}

variable "project_name" {
  type        = string
  default     = "Terraform Demo"
  description = "Name for the fluxychat_project resource"
}

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    fluxychat = {
      source  = "fluxychat/fluxychat"
      version = "0.1.0"
    }
  }
}

provider "fluxychat" {
  worker_url = var.worker_url
  admin_jwt  = var.admin_jwt
}

resource "fluxychat_project" "demo" {
  name = var.project_name
}

output "project_id" {
  value = fluxychat_project.demo.id
}

output "project_plan" {
  value = fluxychat_project.demo.plan
}
