-- Multi-angle VOD replay sync (angle-linked replays + sync group)

ALTER TABLE live_stream_replays ADD COLUMN angle_id TEXT;
ALTER TABLE live_stream_replays ADD COLUMN sync_group_id TEXT;
ALTER TABLE live_stream_replays ADD COLUMN offset_ms INTEGER NOT NULL DEFAULT 0;

ALTER TABLE live_stream_angles ADD COLUMN live_input_uid TEXT;
ALTER TABLE live_stream_angles ADD COLUMN playback_hls TEXT;

CREATE INDEX IF NOT EXISTS idx_live_stream_replays_angle
  ON live_stream_replays (project_id, event_id, angle_id);

CREATE INDEX IF NOT EXISTS idx_live_stream_replays_sync_group
  ON live_stream_replays (project_id, sync_group_id)
  WHERE sync_group_id IS NOT NULL;
