-- Stream Chat channel.mute() HOW: silence inbox fan-out for this room.

CREATE TABLE IF NOT EXISTS room_channel_mutes (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  muted_until TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_channel_mutes_user
  ON room_channel_mutes (project_id, user_id);
