-- Agent Platform: no-code builder configs, versions, deploys, memories (ROADMAP 3.5 persistence).

CREATE TABLE IF NOT EXISTS agent_platform_configs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'dev', 'staging', 'production', 'archived')),
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_platform_configs_project
  ON agent_platform_configs (project_id, workspace_id, status);

CREATE TABLE IF NOT EXISTS agent_platform_versions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  version TEXT NOT NULL,
  commit_hash TEXT NOT NULL,
  message TEXT,
  author TEXT NOT NULL,
  config_json TEXT NOT NULL,
  parent_version TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agent_platform_configs(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_platform_versions_agent_version
  ON agent_platform_versions (agent_id, version);

CREATE TABLE IF NOT EXISTS agent_platform_deploys (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('dev', 'staging', 'production')),
  version TEXT NOT NULL,
  deployed_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'rolled_back')),
  deployed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agent_platform_configs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_platform_deploys_agent
  ON agent_platform_deploys (project_id, agent_id, stage, deployed_at DESC);

CREATE TABLE IF NOT EXISTS agent_platform_memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'fluxy',
  mem_key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES agent_platform_configs(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_platform_memories_unique
  ON agent_platform_memories (agent_id, user_id, platform, mem_key);
