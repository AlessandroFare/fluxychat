CREATE TABLE IF NOT EXISTS llm_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  env TEXT,
  npm TEXT,
  doc TEXT,
  api TEXT,
  logo_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS llm_models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
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
  data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (provider_id) REFERENCES llm_providers(id)
);

CREATE INDEX IF NOT EXISTS idx_llm_models_provider
  ON llm_models (provider_id);

CREATE INDEX IF NOT EXISTS idx_llm_models_search
  ON llm_models (model_id, display_name);

CREATE INDEX IF NOT EXISTS idx_llm_models_status
  ON llm_models (status);
