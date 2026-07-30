# Terraform provider `fluxychat`

Official-style Terraform provider for FluxyChat admin APIs. Ships **`fluxychat_project`** today; webhooks and rooms follow the same pattern.

## Build (local dev)

```bash
cd terraform/providers/fluxychat
go mod tidy
go build -o terraform-provider-fluxychat.exe   # Windows
# go build -o terraform-provider-fluxychat     # macOS/Linux
```

## Install for Terraform CLI

Create `~/.terraform.d/plugins/registry.terraform.io/fluxychat/fluxychat/0.1.0/<os>_<arch>/terraform-provider-fluxychat.exe` and copy the binary, or use dev overrides:

```hcl
# ~/.terraformrc
provider_installation {
  dev_overrides {
    "fluxychat/fluxychat" = "C:/path/to/Chat/terraform/providers/fluxychat"
  }
  direct {}
}
```

## Example

See [`examples/project/main.tf`](examples/project/main.tf).

```hcl
terraform {
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

resource "fluxychat_project" "staging" {
  name = "Staging (Terraform)"
}

output "project_id" {
  value = fluxychat_project.staging.id
}
```

## Resources

| Resource | API | Notes |
|----------|-----|-------|
| `fluxychat_project` | `POST/GET /admin/projects` | Delete is state-only until Worker DELETE exists |

## Cloudflare bindings module

For D1/KV/Worker deploy without the custom provider, use [`../../infra/terraform/fluxychat`](../../infra/terraform/fluxychat).

## Requirements

- Go 1.22+
- Terraform 1.5+
- Admin JWT with `owner` or `admin` role
