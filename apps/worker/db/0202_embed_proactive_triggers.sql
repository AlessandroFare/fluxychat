-- CP-046: Proactive embed widget triggers (URL + dwell time)

ALTER TABLE project_embed_configs ADD COLUMN proactive_triggers_json TEXT;
