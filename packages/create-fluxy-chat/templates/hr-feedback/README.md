# HR Anonymous Feedback Starter

Production starter for anonymous employee feedback with sensitive classification and privacy-safe audit.

## Features

- **Path A** — routine feedback → aggregated anonymous summary room
- **Path B** — sensitive categories → HR escalation hook (category + confidence only, no identity)
- Reuses FluxyChat `approvalChain` + room timeline audit when wired to agent tools
- Classification runs on the worker via `POST /anonymous-feedback`

## Quick start

```bash
cp .env.example .dev.vars
# fill FLUXY_BASE_URL + FLUXY_API_KEY
npm install
npm run dev
```

Submit feedback:

```bash
curl -X POST http://localhost:8787/feedback \
  -H "Content-Type: application/json" \
  -d '{"content":"My manager makes hostile comments in meetings"}'
```

## Endpoints

| Route | Description |
| --- | --- |
| `GET /` | Health check |
| `POST /feedback` | Anonymous submission (no user id stored) |

## Privacy

- Raw message content is **not** persisted by this template
- Worker audit stores **category + timestamp + path** only
- Configure `HR_ESCALATION_WEBHOOK_URL` for your HRIS / ticketing integration

## Learn more

- [FluxyChat docs](https://github.com/AlessandroFare/fluxychat)
- Worker route: `POST /anonymous-feedback` (JWT) for in-app widgets
