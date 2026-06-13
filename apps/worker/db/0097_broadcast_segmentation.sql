-- P20-E: Broadcast Segmentation
CREATE TABLE IF NOT EXISTS broadcast_segments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  segment_type TEXT NOT NULL DEFAULT 'dynamic',
  rules TEXT NOT NULL DEFAULT '[]',
  user_count INTEGER NOT NULL DEFAULT 0,
  last_computed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_broadcast_segments_project ON broadcast_segments(project_id);

CREATE TABLE IF NOT EXISTS broadcast_campaigns (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  segment_id TEXT,
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app',
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  sent_at TEXT,
  total_recipients INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (segment_id) REFERENCES broadcast_segments(id)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_campaigns_project ON broadcast_campaigns(project_id);

CREATE TABLE IF NOT EXISTS broadcast_deliveries (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app',
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TEXT,
  delivered_at TEXT,
  read_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (campaign_id) REFERENCES broadcast_campaigns(id)
);

CREATE INDEX IF NOT EXISTS idx_broadcast_deliveries_campaign ON broadcast_deliveries(campaign_id);
