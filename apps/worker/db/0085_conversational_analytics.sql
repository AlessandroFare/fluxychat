-- P15-L: Conversational Analytics
CREATE TABLE IF NOT EXISTS analytics_queries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  parsed_intent TEXT NOT NULL DEFAULT '{}',
  query_result TEXT NOT NULL DEFAULT '{}',
  response_text TEXT,
  execution_time_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_queries_project ON analytics_queries(project_id);
CREATE INDEX IF NOT EXISTS idx_analytics_queries_time ON analytics_queries(created_at);

CREATE TABLE IF NOT EXISTS analytics_query_cache (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  query_hash TEXT NOT NULL,
  result TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_hash ON analytics_query_cache(project_id, query_hash);
