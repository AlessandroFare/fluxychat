-- Audit S-35: per-agent allow-list of tool names the LLM is permitted
-- to invoke. The list is enforced at extraction time
-- (lib/agent-tool-calls.js), not at the OpenAI/Anthropic tools-schema
-- level, because the LLM can hallucinate tool names that match the
-- declared schema. NULL = legacy behaviour (rely on declared schema
-- only); '[]' = deny all; '["foo","bar"]' = allow exactly those.

ALTER TABLE bots ADD COLUMN allowed_tools TEXT;
-- Audit S-35: per-project default allow-list applied to every agent in
-- the project that has not set its own `allowed_tools`. Same semantics.
ALTER TABLE projects ADD COLUMN default_allowed_tools TEXT;
