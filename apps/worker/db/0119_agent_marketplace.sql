-- Agent Marketplace: publish, discover, install AI agents

CREATE TABLE IF NOT EXISTS agent_marketplace (
  id TEXT PRIMARY KEY,
  publisher_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  long_description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  icon_url TEXT,
  config_template TEXT NOT NULL,
  system_prompt TEXT,
  tools TEXT,
  integrations TEXT,
  pricing TEXT DEFAULT 'free',
  pricing_config TEXT,
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'rejected', 'archived')),
  install_count INTEGER NOT NULL DEFAULT 0,
  avg_rating REAL NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  tags TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_marketplace_category
  ON agent_marketplace (category, status, featured);
CREATE INDEX IF NOT EXISTS idx_marketplace_publisher
  ON agent_marketplace (publisher_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_slug
  ON agent_marketplace (slug);

CREATE TABLE IF NOT EXISTS agent_marketplace_installs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  installed_by TEXT NOT NULL,
  config_override TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_install_project
  ON agent_marketplace_installs (project_id, enabled);
CREATE UNIQUE INDEX IF NOT EXISTS idx_install_unique
  ON agent_marketplace_installs (agent_id, project_id);

CREATE TABLE IF NOT EXISTS agent_marketplace_reviews (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  body TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_agent
  ON agent_marketplace_reviews (agent_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_unique
  ON agent_marketplace_reviews (agent_id, project_id);
