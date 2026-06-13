-- P20-I: Store / Field Ops Mode
CREATE TABLE IF NOT EXISTS field_ops_templates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL DEFAULT 'checklist',
  fields TEXT NOT NULL DEFAULT '[]',
  safety_alerts INTEGER NOT NULL DEFAULT 0,
  photo_required INTEGER NOT NULL DEFAULT 0,
  offline_queue INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_field_ops_templates_project ON field_ops_templates(project_id);

CREATE TABLE IF NOT EXISTS field_ops_updates (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  update_type TEXT NOT NULL DEFAULT 'status',
  content TEXT NOT NULL,
  photo_url TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  synced INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (template_id) REFERENCES field_ops_templates(id)
);

CREATE INDEX IF NOT EXISTS idx_field_ops_updates_room ON field_ops_updates(project_id, room_id);
