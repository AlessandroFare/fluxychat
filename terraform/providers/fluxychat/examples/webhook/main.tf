variable "worker_url" {
  type        = string
  description = "FluxyChat Worker base URL"
}

variable "admin_jwt" {
  type        = string
  sensitive   = true
  description = "Admin JWT scoped to the target project"
}

variable "webhook_url" {
  type        = string
  description = "HTTPS endpoint that receives FluxyChat webhook payloads"
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

resource "fluxychat_webhook" "messages" {
  url = var.webhook_url
  event_types = [
    "message.created",
    "mention",
  ]
}

output "webhook_id" {
  value = fluxychat_webhook.messages.id
}
