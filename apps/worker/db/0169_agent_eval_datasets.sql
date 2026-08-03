-- Agent eval datasets for Langfuse-style regression loops (roadmap #9)

CREATE TABLE IF NOT EXISTS agent_eval_datasets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cases_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_eval_datasets_project
  ON agent_eval_datasets (project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS agent_eval_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  status TEXT NOT NULL,
  pass_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  results_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_eval_runs_project
  ON agent_eval_runs (project_id, created_at DESC);
