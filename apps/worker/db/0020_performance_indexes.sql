-- Performance indexes for high-volume queries
-- Added: May 2026 as part of M6 scale optimization

-- Message queries by project + room + time (most frequent)
CREATE INDEX IF NOT EXISTS idx_messages_project_room_created 
ON messages (project_id, room_id, created_at DESC);

-- Room lookups by project
CREATE INDEX IF NOT EXISTS idx_rooms_project_type 
ON rooms (project_id, type);

-- Room members lookups
CREATE INDEX IF NOT EXISTS idx_room_members_room_user 
ON room_members (room_id, user_id);

-- Message reactions by message
CREATE INDEX IF NOT EXISTS idx_reactions_message_room 
ON message_reactions (message_id, room_id);

-- Read receipts by room + user
CREATE INDEX IF NOT EXISTS idx_read_receipts_room_user 
ON read_receipts (room_id, user_id, created_at DESC);

-- Operational metrics by project + metric + time window
CREATE INDEX IF NOT EXISTS idx_operational_metrics_lookup 
ON operational_metrics (project_id, metric_name, bucket_minute DESC);

-- Usage tracking by project + month
CREATE INDEX IF NOT EXISTS idx_project_usage_lookup 
ON project_usage_monthly (project_id, metric_name, month_key);

-- Webhook deliveries by project + status
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status 
ON webhook_deliveries (project_id, status, created_at DESC);

-- Moderation events by room + user + time
CREATE INDEX IF NOT EXISTS idx_moderation_events_lookup 
ON moderation_events (room_id, user_id, created_at DESC);

-- Search: messages content full-text (basic LIKE optimization)
CREATE INDEX IF NOT EXISTS idx_messages_content_gin 
ON messages (content);
