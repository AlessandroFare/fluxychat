-- Guest → account linking (nakama borrow): a signed-in account claims a guest
-- identity by presenting its token. Room memberships move to the target and the
-- claim is recorded here so the same guest cannot be claimed twice.
CREATE TABLE IF NOT EXISTS guest_links (
  project_id TEXT NOT NULL,
  guest_user_id TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  linked_at TEXT NOT NULL,
  PRIMARY KEY (project_id, guest_user_id)
);

CREATE INDEX IF NOT EXISTS idx_guest_links_target
  ON guest_links (project_id, target_user_id);
