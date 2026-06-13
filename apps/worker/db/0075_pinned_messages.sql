-- P17-K: Pinned Knowledge + Highlights
-- Multi-pin system per room with categories

CREATE TABLE IF NOT EXISTS room_pins (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  pinned_by TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'important' CHECK(category IN ('decision', 'info', 'checklist', 'important')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(room_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_room_pins_room ON room_pins(room_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_room_pins_project ON room_pins(project_id);
