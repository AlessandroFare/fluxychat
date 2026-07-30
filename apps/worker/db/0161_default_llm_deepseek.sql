-- Default LLM for built-in agents: OpenCode Zen gateway + DeepSeek Flash v4
UPDATE builtin_agent_templates
SET provider = 'custom', model = 'deepseek-v4-flash-free'
WHERE id IN ('builtin-assistant', 'builtin-onboarding', 'builtin-summarizer', 'builtin-moderator');
