-- Hosted room templates (anonymous, deny, capabilities, extension slots).
ALTER TABLE project_publish_config ADD COLUMN rooms_json TEXT NOT NULL DEFAULT '{}';
