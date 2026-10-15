# FluxyOps follow (research clones)

Local clones stay under `docs/research/` (gitignored). Reimplement HOW. Do not paste source.

## Done

- [x] AI Search contract: `chunks` + `retrieval.filters` + Items upload; Vectorize then D1 fallback
- [x] Wrangler comments for `ai_search` / `ai_search_namespaces` (`[ai]` stays STT/TTS)
- [x] Per-tenant namespace `get` / `create` when the binding supports it
- [x] Hybrid search + match threshold + rerank/query-rewrite options
- [x] `files.search` / `files.read` return `citations`
- [x] `agent_task` that searches files must cite (lint + builder)
- [x] Room RAG `enhancePrompt` returns the same citation shape
- [x] Named views Wren-lite (columns, joins, synonyms); lookup instructions use that catalog
- [x] Unknown view-filter columns rejected
- [x] File bytes on `OPS_R2` or existing `ATTACHMENTS`
- [x] OCR via stored text, else Workers AI `toMarkdown`
- [x] Persist AI Search `itemId` after ingest
- [x] `GET /ops/sources` health in Tools and policy
- [x] `wait_for_guest` issues a scoped invite when context has the guest email

## Do not (standing)

- Nango (ELv2) or hosting its runtime
- Onyx `ee/` or 60 file connectors
- Cloudflare `useAgent` / re-export `agents`
- n8n node catalog / Botpress Cloud studio
- Next integration-kit cluster without an external design partner
- Homepage FluxyOps / relabel labs to production
- Hyperdrive until a tenant Postgres named view exists
