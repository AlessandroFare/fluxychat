# Fluxychat — Show HN launch playbook

Internal founder doc. Copy-paste from here on launch day. Update after feedback using the **Post-launch feedback** section at the bottom.

---

## Positioning (use everywhere)

**Thesis:** REST became trivial on serverless. Realtime still requires another infra stack.

**One-liner:** Realtime that feels like serverless.

**Sub:** WebSockets on Cloudflare Workers + D1 — MIT self-host or hosted quickstart.

**Links:**
- Demo: https://fluxychat.vercel.app/landing
- Why: https://fluxychat.vercel.app/why
- Repo: https://github.com/AlessandroFare/fluxychat
- npm: https://www.npmjs.com/package/@fluxy-chat/sdk
- Support: fluxychat@outlook.com

---

## Launch Research (patterns from successful infra Show HNs)

### Title patterns that work

1. `Show HN: [Name] – [what it is] on [stack]`
2. Emphasize **self-host + open source** when true (DriftDB, Sockudo, Hatchet)
3. Name the **pain** implicitly: WebSocket backend, edge, SDK, Pusher-compatible, etc.
4. Avoid hype words: revolutionary, AI-first, disrupting
5. Keep under ~80 characters

### Founder tone that works on HN

- Solo or small team, technical, honest about beta limits
- Reply fast with tradeoffs, not marketing
- Admit what breaks; link to architecture or `/why`
- Do not argue with trolls; thank sharp criticism

### Common objections (prepare answers)

| Objection | Angle |
|-----------|--------|
| "Why not Stream/TalkJS?" | Mature UI vendors vs edge control + MIT + your Worker |
| "Why open source if paid?" | Trust + self-host; hosted = convenience |
| "Cloudflare lock-in" | Honest: reference impl is CF-native; porting = rewrite |
| "Another chat SDK" | Wedge is chat; thesis is serverless-grade realtime infra |
| "Not production ready" | Open beta; want real integrations before GA |
| "Vercel doesn't do WS" | Exactly the pain — edge Worker for stateful part |

### Launch mistakes to avoid

- Posting at midnight US / weekend without monitoring
- Zero text comment (always add context in first comment if URL-only)
- Ignoring comments for 6+ hours
- Overclaiming vs Stream/Firebase
- Hiding that it's beta
- Feature coding on launch day instead of replying

---

## 10 Show HN title options

1. `Show HN: Fluxychat – edge-native chat on Cloudflare Workers (open SDK + MIT self-host)`
2. `Show HN: Fluxychat – WebSockets on Workers + D1 without a second infra stack`
3. `Show HN: Fluxychat – realtime chat that feels like serverless (MIT, hosted beta)`
4. `Show HN: Fluxychat – open-source chat SDK for Cloudflare Workers + Durable Objects`
5. `Show HN: Fluxychat – self-hostable chat on Workers or try hosted cloud in minutes`
6. `Show HN: Fluxychat – useChat(roomId) on Cloudflare edge, MIT monorepo`
7. `Show HN: Fluxychat – when your app is on Vercel but sockets shouldn't be on Pusher`
8. `Show HN: Fluxychat – Workers + DO + D1 for in-app chat (open beta)`
9. `Show HN: Fluxychat – operator console + SDK for edge-native realtime chat`
10. `Show HN: Fluxychat – MIT chat backend on Cloudflare, optional hosted quickstart`

**Recommended:** #1 or #2

---

## Show HN post (first comment / body)

```
Hi HN — I'm the solo builder of Fluxychat.

Thesis: deploying REST on Vercel/Netlify is trivial; stateful WebSockets still push you to another vendor, sales calls, or a second ops stack.

Fluxychat is my attempt to make edge-native chat feel closer to serverless:
- Cloudflare Workers + Durable Objects + D1
- TypeScript SDK on npm (@fluxy-chat/sdk) with useChat(roomId)
- Next.js console: onboarding wizard, rooms, agents, webhooks, GDPR export

Try open beta: https://fluxychat.vercel.app/landing
Why / tradeoffs: https://fluxychat.vercel.app/why
MIT source: https://github.com/AlessandroFare/fluxychat

Hosted cloud: sign up → quickstart in a few minutes.
Self-host: clone the repo, deploy the Worker to your Cloudflare account.

I'm looking for blunt feedback on:
- onboarding clarity
- SDK ergonomics
- whether this wedge (chat on your edge) resonates vs managed vendors

Happy to answer architecture questions. Still beta — not claiming GA.

Support: fluxychat@outlook.com
```

---

## 15 likely HN questions + answers

**1. How is this different from Stream or TalkJS?**  
They optimize mature SDKs and UI speed. Fluxychat optimizes for data on your Worker/D1, MIT source, and a path from hosted trial to self-host. Trade-off: younger product, more DIY UI.

**2. Why open source if you charge?**  
MIT repo for trust and self-hosters. Hosted cloud saves setup (Clerk, provisioning, console, billing hooks). Same model as many dev tools.

**3. Is it production-ready?**  
Open beta. Core paths work (rooms, messages, onboarding, GDPR export) but I want reports from real integrations before GA.

**4. Why Cloudflare only?**  
DO + D1 fit room state and message storage at the edge. Porting would replace Workers/DO/D1 — not supported today.

**5. How do you make money?**  
Hosted cloud plans + quotas on messages/agent invokes. Self-hosters pay Cloudflare directly.

**6. What about Supabase Realtime / Convex?**  
They bundle realtime with their database. Fluxychat doesn't ask you to migrate Postgres — only deploy (or use) Worker + D1.

**7. Can I use this on Vercel frontend only?**  
Yes — frontend on Vercel, Worker on Cloudflare for WebSockets. Common split.

**8. What's the latency model?**  
Rooms are Durable Objects; messages persist to D1. Edge placement follows your Cloudflare config.

**9. Multi-tenant hosted security?**  
JWT-scoped projects, tenant isolation in Worker policy, Clerk for dashboard auth. Happy to detail in thread.

**10. Why not Pusher/Ably?**  
Great managed channels at scale. Fluxychat for teams who want ownable schema and MIT code, or cheap hosted trial first.

**11. Agents / AI?**  
Optional step in quickstart — bots use same rooms and member JWT model. Not the main pitch.

**12. GDPR?**  
Export/delete routes in console; data on your Worker/D1 when self-hosted.

**13. Pricing?**  
Free tier on hosted; see landing pricing table. Self-host = Cloudflare bill only.

**14. What's broken / missing?**  
Beta: polish, scale testing, enterprise SSO. I'll be honest in thread if you hit issues.

**15. Why should I trust a solo project?**  
MIT code you can audit and self-host. Try hosted without lock-in to proprietary backend.

---

## Launch day checklist

### Before (T-1 day)

- [ ] Onboarding from zero account works
- [ ] `/why` and `/landing` live on production URL
- [ ] README pinned links updated on GitHub
- [ ] Video 90s uploaded (Loom/YouTube) — optional link in post
- [ ] Calendar block 6–8h for HN replies
- [ ] This doc open in second monitor

### Submit (T-0)

- **When:** Tuesday–Thursday, 15:00–17:00 CET (9–11 AM US East)
- **URL:** https://fluxychat.vercel.app/landing (or `/why` if you want thesis-first)
- **Title:** pick from list above
- **First comment:** paste post body if needed
- **LinkedIn:** 30 min after, same thesis, link to HN thread

### During (T+0 to T+8h)

- Reply to every comment within ~30 min when possible
- Copy user phrases into notes for copy fixes
- Do **not** ship features — only critical hotfixes
- Log bugs as GitHub issues with `hn-launch` label

### After (T+1 to T+7 days)

Run **Post-launch feedback** prompt below on all comments + emails.

---

## LinkedIn post (launch day)

```
Shipped the open beta of Fluxychat.

Thesis: REST on serverless is trivial. Realtime WebSockets still mean another vendor or socket ops.

Built on Cloudflare (Workers + Durable Objects + D1):
• npm SDK with useChat
• MIT self-host or hosted quickstart
• Console for rooms, agents, GDPR

Not claiming to replace every chat vendor — chat is the wedge for edge-native realtime.

Show HN: [paste link when live]
Why / tradeoffs: https://fluxychat.vercel.app/why

Blunt onboarding feedback welcome.
```

---

## X thread (optional)

**Tweet 1:**  
Open beta: Fluxychat — realtime on @Cloudflare Workers + D1. MIT self-host or hosted quickstart. Show HN: [link]

**Tweet 2:**  
Thesis: REST feels like serverless. WebSockets still don't. useChat(roomId) + operator console.

**Tweet 3:**  
Solo-built, still beta. Try https://fluxychat.vercel.app/landing — tell me what breaks in onboarding.

---

## Video script (90s, voice AI + subtitles)

```
[0:00] REST on Vercel is one file. Realtime WebSockets? Still another vendor or another ops stack.

[0:10] I built Fluxychat — chat on Cloudflare Workers, Durable Objects, and D1.

[0:18] npm SDK with useChat. MIT repo. Hosted open beta or deploy to your own Cloudflare account.

[0:28] Sign up, quickstart wizard: connect, project, member JWT, room, first message.

[0:38] Console covers rooms, agents, webhooks, GDPR export.

[0:45] Why not just Stream or TalkJS? You own the Worker and D1. Fork when you need control.

[0:55] Try fluxychat.vercel.app. Why page explains tradeoffs.

[1:02] Open beta — I'm the solo builder. Blunt feedback on onboarding helps more than hype.

[1:10] Thanks.
```

---

## Post-launch feedback prompt (run in Cursor after HN)

Paste into chat:

```
Analyze this launch feedback [paste HN comments, GitHub issues, emails, LinkedIn].

Cluster by theme: onboarding, pricing, self-host, comparison, bugs, positioning.
Rank by frequency and severity.
Quote exact user phrases for messaging.
Suggest:
- onboarding fixes (priority order)
- copy changes for /landing and /why
- FAQ additions
- what NOT to build yet

Output: ranked action list for next 7 days.
```

---

## 72-hour plan (reference)

| Day | Focus |
|-----|--------|
| 1 | README, landing, /why, video, HN prep (this doc) |
| 2 | Fresh onboarding test, fix top friction, rehearse answers |
| 3 | Show HN + LinkedIn, monitor all day, no feature work |

---

*Last updated: launch prep. Regenerate feedback section after Show HN.*
