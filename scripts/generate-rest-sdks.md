# Generated REST SDKs (Python, Go)

Source of truth: `apps/worker/openapi.yaml`. The Worker has more HTTP routes than the spec; keep filling the spec. Do not use Speakeasy (AGPL-3.0 generator). Stainless hosted generator is winding down.

Use **OpenAPI Generator** (Apache-2.0). Generated output is Apache-2.0 unless the template says otherwise — check the header of each generated file before publishing.

```bash
# from repo root
docker run --rm -v "${PWD}:/local" openapitools/openapi-generator-cli generate \
  -i /local/apps/worker/openapi.yaml \
  -g python \
  -o /local/packages/python/generated \
  --additional-properties=packageName=fluxychat_rest,projectName=fluxychat-rest

docker run --rm -v "${PWD}:/local" openapitools/openapi-generator-cli generate \
  -i /local/apps/worker/openapi.yaml \
  -g go \
  -o /local/packages/sdk-go/generated \
  --additional-properties=packageName=fluxychatrest
```

`packages/python/generated` and `packages/sdk-go/generated` are gitignored until a maintainer commits a pin. WebSocket join stays hand-written (`fluxychat.room.connect_room_ws`, `packages/sdk-go/room.go`). MCP server generation is optional (`-g rust-server` / community MCP templates); Speakeasy MCP output is AGPL — skip.

Fern’s free tier caps at 200 endpoints. Count paths in `openapi.yaml` before choosing Fern.

Not published to PyPI or pkg.go.dev until the generated tree is reviewed.
