-- Audit F-89: bounded priority-queue reads order by severity bucket + recency.
CREATE INDEX IF NOT EXISTS idx_ai_mod_queue_priority
  ON ai_moderation_queue (project_id, severity, created_at);
