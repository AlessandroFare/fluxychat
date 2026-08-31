-- Hosted fluxy.config overlay: deny/mask without forking the Worker.
CREATE TABLE IF NOT EXISTS project_publish_config (
  project_id TEXT PRIMARY KEY,
  deny_substrings TEXT NOT NULL DEFAULT '[]',
  guest_can_publish INTEGER NOT NULL DEFAULT 1,
  iot_auto_agent_id TEXT,
  updated_at TEXT NOT NULL
);
