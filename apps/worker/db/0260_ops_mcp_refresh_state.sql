-- Refresh-failure bookkeeping for per-user MCP OAuth connections. A transient
-- AS/IdP outage used to expire the connection on the first failed refresh;
-- it now records a failure timestamp (30s cooldown) and a day-counted attempt
-- counter, and the connection only expires after 4 counted failure days.
ALTER TABLE ops_mcp_connections ADD COLUMN last_refresh_failure TEXT;
ALTER TABLE ops_mcp_connections ADD COLUMN refresh_attempts INTEGER NOT NULL DEFAULT 0;
