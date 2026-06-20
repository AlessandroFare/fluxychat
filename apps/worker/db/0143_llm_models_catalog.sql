CREATE TABLE IF NOT EXISTS llm_models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  provider_name TEXT,
  display_name TEXT NOT NULL,
  description TEXT,
  capabilities TEXT NOT NULL DEFAULT '{}',
  cost TEXT,
  context_limit INTEGER,
  input_limit INTEGER,
  output_limit INTEGER,
  modalities TEXT,
  status TEXT DEFAULT 'active',
  release_date TEXT,
  knowledge_cutoff TEXT,
  open_weights INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_llm_models_provider
  ON llm_models (provider_id);

CREATE INDEX IF NOT EXISTS idx_llm_models_search
  ON llm_models (model_id, display_name);

CREATE INDEX IF NOT EXISTS idx_llm_models_status
  ON llm_models (status);
