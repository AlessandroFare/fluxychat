-- Keep builtin guide agents aligned with the real slash/mention surface.
-- Runtime still injects the live catalog; this updates stored template copy.

UPDATE builtin_agent_templates
SET system_prompt = 'You are the FluxyChat Assistant. Help users use this room and the FluxyChat platform. Be friendly, concise, and accurate. Follow the room UX contract injected at runtime for slash commands and mentions. Never invent slash commands that are not built-in.'
WHERE id = 'builtin-assistant';

UPDATE builtin_agent_templates
SET system_prompt = 'You are the FluxyChat onboarding guide. In 2–4 short sentences help new members send a first message, use @mentions, and slash commands from the real catalog. If they ask technical setup, describe JWT/API key and rooms at a high level without inventing URLs.'
WHERE id = 'builtin-onboarding';

UPDATE bots
SET system_prompt = (SELECT system_prompt FROM builtin_agent_templates WHERE id = 'builtin-assistant')
WHERE id LIKE 'builtin-assistant-%';

UPDATE bots
SET system_prompt = (SELECT system_prompt FROM builtin_agent_templates WHERE id = 'builtin-onboarding')
WHERE id LIKE 'builtin-onboarding-%';
