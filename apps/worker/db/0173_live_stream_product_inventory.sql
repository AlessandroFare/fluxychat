-- Live commerce: inventory, MOQ, checkout click analytics

ALTER TABLE live_stream_products ADD COLUMN inventory_qty INTEGER;
ALTER TABLE live_stream_products ADD COLUMN moq INTEGER NOT NULL DEFAULT 1;
ALTER TABLE live_stream_products ADD COLUMN units_sold INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS live_stream_checkout_clicks (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  checkout_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (event_id) REFERENCES live_events(id),
  FOREIGN KEY (product_id) REFERENCES live_stream_products(id)
);

CREATE INDEX IF NOT EXISTS idx_live_stream_checkout_clicks_event
  ON live_stream_checkout_clicks (project_id, event_id, created_at DESC);
