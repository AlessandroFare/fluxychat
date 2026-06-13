-- AI Companions Advanced (multi-agent conversations, personality learning, emotion tracking)

CREATE TABLE IF NOT EXISTS companion_conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  started_by_companion_id TEXT,
  started_by_user_id TEXT,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended', 'handoff')),
  conversation_type TEXT NOT NULL DEFAULT 'group' CHECK (conversation_type IN ('group', 'pair', 'broadcast')),
  created_at TEXT NOT NULL,
  ended_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_conv_room
  ON companion_conversations (room_id, status);
CREATE INDEX IF NOT EXISTS idx_conv_project
  ON companion_conversations (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS companion_conversation_participants (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('companion', 'user')),
  participant_id TEXT NOT NULL,
  role TEXT DEFAULT 'observer' CHECK (role IN ('host', 'moderator', 'participant', 'observer')),
  joined_at TEXT NOT NULL,
  left_at TEXT,
  last_active_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_conv_part_conv
  ON companion_conversation_participants (conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participant
  ON companion_conversation_participants (participant_type, participant_id);

CREATE TABLE IF NOT EXISTS companion_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('companion', 'user', 'system')),
  sender_id TEXT NOT NULL,
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'action', 'question', 'suggestion', 'handoff', 'emotion')),
  reply_to_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comp_msg_conv
  ON companion_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_comp_msg_project
  ON companion_messages (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS companion_personality_log (
  id TEXT PRIMARY KEY,
  companion_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  trait TEXT NOT NULL,
  old_value REAL,
  new_value REAL,
  reason TEXT,
  interaction_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_personality_companion
  ON companion_personality_log (companion_id, created_at DESC);

CREATE TABLE IF NOT EXISTS companion_emotion_state (
  id TEXT PRIMARY KEY,
  companion_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  room_id TEXT,
  emotion TEXT NOT NULL CHECK (emotion IN ('neutral', 'happy', 'excited', 'curious', 'confused', 'frustrated', 'helpful', 'thoughtful', 'humorous', 'serious')),
  intensity REAL DEFAULT 0.5,
  trigger_event TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_emotion_companion
  ON companion_emotion_state (companion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emotion_room
  ON companion_emotion_state (room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS companion_delegations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  from_companion_id TEXT,
  from_user_id TEXT,
  to_companion_id TEXT,
  to_user_id TEXT,
  delegation_type TEXT NOT NULL CHECK (delegation_type IN ('escalate', 'transfer', 'collaborate', 'consult')),
  reason TEXT,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_delegate_room
  ON companion_delegations (room_id, status);
CREATE INDEX IF NOT EXISTS idx_delegate_project
  ON companion_delegations (project_id, created_at DESC);
