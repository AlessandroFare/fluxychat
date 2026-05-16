-- Agent tool calling support (SPEC §7)
-- Adds system_prompt, context_fetch_url, tool_execute_url, tools_schema, rate_limit_rpm
-- to bots table and tool_calls_json + context_fetched to agent_runs

ALTER TABLE bots ADD COLUMN system_prompt TEXT;
ALTER TABLE bots ADD COLUMN context_fetch_url TEXT;
ALTER TABLE bots ADD COLUMN tool_execute_url TEXT;
ALTER TABLE bots ADD COLUMN tools_schema TEXT;
ALTER TABLE bots ADD COLUMN rate_limit_rpm INTEGER DEFAULT 60;

ALTER TABLE agent_runs ADD COLUMN tool_calls_json TEXT;
ALTER TABLE agent_runs ADD COLUMN context_fetched INTEGER DEFAULT 0;
ALTER TABLE agent_runs ADD COLUMN iterations INTEGER DEFAULT 1;
