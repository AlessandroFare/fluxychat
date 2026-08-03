-- Counterfactual replay (#44): branch-linked agent runs with modified tool params
ALTER TABLE agent_runs ADD COLUMN branch_id TEXT;
ALTER TABLE agent_runs ADD COLUMN counterfactual_of TEXT;
ALTER TABLE agent_runs ADD COLUMN modified_params TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_runs_counterfactual_of
  ON agent_runs (project_id, counterfactual_of);

CREATE INDEX IF NOT EXISTS idx_agent_runs_branch_id
  ON agent_runs (branch_id);
