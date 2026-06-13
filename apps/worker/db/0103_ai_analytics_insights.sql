-- P14-G: AI-Powered Analytics Insights
CREATE TABLE IF NOT EXISTS ai_analytics_insights (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('engagement', 'activity', 'performance', 'retention', 'content', 'agent', 'custom')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  data TEXT DEFAULT '{}',
  period_start TEXT,
  period_end TEXT,
  model TEXT,
  confidence REAL DEFAULT 0,
  generated_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_analytics_project ON ai_analytics_insights(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_analytics_type ON ai_analytics_insights(insight_type);
