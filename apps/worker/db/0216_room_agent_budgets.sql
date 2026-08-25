-- F2: per-room agent token budget (hard circuit breaker).
--
-- A room can cap the tokens its AI agents may consume per billing month.
-- Consumption truth lives in agent_runs (input_tokens + output_tokens), summed
-- per month by lib/agent-budget.js BEFORE any LLM call is made. No row for a
-- room = uncapped (default-off keeps existing rooms unchanged).

CREATE TABLE IF NOT EXISTS room_agent_budgets (
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  monthly_token_budget INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_agent_budgets_project
  ON room_agent_budgets (project_id, enabled);
