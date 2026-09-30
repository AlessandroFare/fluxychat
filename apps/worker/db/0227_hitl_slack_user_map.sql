-- Optional Slack user id → FluxyChat user id for HITL interactive buttons.
-- When a mapping exists for the current approver, Slack button `value` is the
-- approval UUID only (no HMAC tap token in the Slack transcript).

CREATE TABLE IF NOT EXISTS hitl_slack_user_map (
  project_id TEXT NOT NULL,
  slack_user_id TEXT NOT NULL,
  fluxy_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, slack_user_id)
);

CREATE INDEX IF NOT EXISTS idx_hitl_slack_map_user
  ON hitl_slack_user_map (project_id, fluxy_user_id);
