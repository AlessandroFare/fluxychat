-- F2: inflight token holds so two concurrent mention invokes cannot both
-- pass a check-then-spend gate and overshoot the monthly cap.
--
-- tryReserveRoomAgentTokens() increments inflight_tokens atomically when
-- used(agent_runs) + inflight + reserve <= monthly_token_budget.
-- After the LLM run, releaseRoomAgentTokens() decrements the hold; actual
-- consumption is already in agent_runs.

ALTER TABLE room_agent_budgets ADD COLUMN inflight_tokens INTEGER NOT NULL DEFAULT 0;
