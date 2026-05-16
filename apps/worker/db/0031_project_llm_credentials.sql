-- Per-project LLM API keys (encrypted) and optional base URL overrides

CREATE TABLE IF NOT EXISTS project_llm_credentials (
  project_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  api_key_ciphertext TEXT,
  api_key_iv TEXT,
  base_url TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_project_llm_credentials_project
  ON project_llm_credentials (project_id);
