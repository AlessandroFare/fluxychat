-- Sync built-in agent templates + existing project bots to OpenCode Zen DeepSeek Flash (free)
UPDATE builtin_agent_templates
SET provider = 'custom', model = 'deepseek-v4-flash-free'
WHERE id IN ('builtin-assistant', 'builtin-onboarding', 'builtin-summarizer', 'builtin-moderator');

UPDATE bots
SET provider = 'custom', model = 'deepseek-v4-flash-free'
WHERE id LIKE 'builtin-assistant-%'
   OR id LIKE 'builtin-onboarding-%'
   OR id LIKE 'builtin-summarizer-%'
   OR id LIKE 'builtin-moderator-%';
