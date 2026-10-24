-- Tool pinning for the ops MCP gateway. Each discovered tool keeps the SHA-256
-- of its full definition (description, input/output schema, annotations) and
-- the hash an admin last approved. When the two differ the tool is blocked
-- until it is re-approved, so a server cannot silently rewrite tool behaviour
-- after it passed review (OWASP MCP03 tool poisoning).
ALTER TABLE ops_mcp_servers ADD COLUMN tools_catalog_json TEXT;
