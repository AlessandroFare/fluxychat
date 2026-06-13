-- P15-N: Gamification layer
-- Badges, XP, leaderboard, streaks

CREATE TABLE IF NOT EXISTS gamification_badges (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT '🏅',
  badge_type TEXT NOT NULL DEFAULT 'achievement' CHECK(badge_type IN ('achievement', 'streak', 'milestone', 'special')),
  xp_reward INTEGER NOT NULL DEFAULT 10,
  criteria_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_badges_project ON gamification_badges(project_id, is_active);

CREATE TABLE IF NOT EXISTS user_gamification (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  room_id TEXT,
  xp_total INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  messages_count INTEGER NOT NULL DEFAULT 0,
  reactions_given INTEGER NOT NULL DEFAULT 0,
  reactions_received INTEGER NOT NULL DEFAULT 0,
  polls_voted INTEGER NOT NULL DEFAULT 0,
  forms_submitted INTEGER NOT NULL DEFAULT 0,
  handoffs_completed INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_gamification_project ON user_gamification(project_id, xp_total DESC);
CREATE INDEX IF NOT EXISTS idx_user_gamification_room ON user_gamification(project_id, room_id, xp_total DESC);

CREATE TABLE IF NOT EXISTS user_badges (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (badge_id) REFERENCES gamification_badges(id) ON DELETE CASCADE,
  UNIQUE(project_id, user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(project_id, user_id);

CREATE TABLE IF NOT EXISTS xp_log (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  xp_amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_xp_log_user ON xp_log(project_id, user_id, created_at DESC);
