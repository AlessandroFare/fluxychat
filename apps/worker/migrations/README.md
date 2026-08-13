# Deprecated — use `apps/worker/db/`

Migrations were consolidated into `apps/worker/db/` (Wrangler `migrations_dir = "db"`).

| Old file | New file |
|----------|----------|
| `0011_room_presence_escalations.sql` | `db/0206_room_presence_escalations.sql` |
| `0012_room_session_profiles.sql` | `db/0207_room_session_profiles.sql` |
| `0013_room_config.sql` | `db/0208_room_config.sql` |
| `0014_hitl_approval_requests.sql` | `db/0209_hitl_approval_requests.sql` |
| `0015_room_timeline_events.sql` | `db/0210_room_timeline_events.sql` |
| `0016_message_versioning.sql` | `db/0211_message_versioning.sql` |
| `0017_anonymous_feedback.sql` | `db/0212_anonymous_feedback.sql` |
| `0018_template_registry.sql` | `db/0213_template_registry.sql` |

`0010_users_profile.sql` was a duplicate of `db/0147_users_profile.sql` — do not apply.

Apply in production:

```bash
cd apps/worker
wrangler d1 migrations list fluxychat --remote
wrangler d1 migrations apply fluxychat --remote
```
