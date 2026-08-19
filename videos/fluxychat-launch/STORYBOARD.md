---
format: 1920x1080
duration: 76s
message: "Chat and AI agents share one realtime timeline — with visible tool calls"
arc: Hook → Problem → Solution → Infrastructure → Demo proof → CTA
audience: Developers and founders shipping realtime + AI
mode: autonomous
music: tech-launch-upbeat
---

## Video direction

Canvas 1920×1080, 24fps feel. Palette from FluxyChat brand: warm canvas `#FDFBF9`, ink `#0E1316`,
brand orange `#c2410c`, dark demo sections `#020617`. Typography: Geist. Motion: kinetic type
stagger, screenshot parallax push-ins, terminal cursor blink, crossfade between demo beats.
Captions: bottom karaoke pill. Avatar PiP (when asset available): bottom-right, 320×180, rounded.

---

## Frame 1 — Hook

- scene: Kinetic type — REST vs WebSockets vs AI agents as three punch cards
- duration: 18.304s
- poster: 4s
- transition_in: cut
- status: outline
- voiceover: Deploying a REST API is easy. But what about handling real-time WebSockets...
- blueprint: kinetic-headline
- asset_candidates: capture/screenshots/scroll-000.png
- src: compositions/frames/01-hook.html

Scene 1 (0–2s): Dark canvas, "REST API" card slams in center.
Scene 2 (2–5s): "WebSockets" card slides from left with orange accent line.
Scene 3 (5–8s): "AI agents in chat?" card scales up; vendor price tag "$$$" flickers.
Scene 4 (8–12s): Three cards compress; "bolted on" label stamps over AI card.

## Frame 2 — Solution

- scene: FluxyChat logo + hero headline with timeline metaphor
- duration: 12.053s
- poster: 6s
- transition_in: crossfade
- status: outline
- voiceover: There's a better way. That's why I built FluxyChat...
- blueprint: product-hero
- asset_candidates: capture/assets/svgs/logo-66f258ab.svg, capture/screenshots/scroll-000.png
- src: compositions/frames/02-solution.html

Scene 1 (0–3s): Logo draws in; "FluxyChat" wordmark fades up.
Scene 2 (3–7s): Split timeline graphic — human messages left, agent messages right, same rail.
Scene 3 (7–11s): Tool call chip animates inline in timeline with visible JSON snippet.
Scene 4 (11–14s): "Open source" + "MIT" badges pop in.

## Frame 3 — Infrastructure

- scene: Cloudflare stack diagram — Workers, DO, D1 nodes
- duration: 11.861s
- poster: 5s
- transition_in: crossfade
- status: outline
- voiceover: Powered by Cloudflare Workers, Durable Objects, and D1...
- blueprint: architecture-diagram
- asset_candidates: capture/screenshots/scroll-026.png
- src: compositions/frames/03-infrastructure.html

Scene 1 (0–3s): Three node cards fly in: Workers / Durable Objects / D1.
Scene 2 (3–6s): Globe wireframe pulse — "globally distributed".
Scene 3 (6–10s): Two path cards: "Self-host" and "Hosted" with arrow connectors.

## Frame 4 — SDK tease

- scene: Code snippet + console preview thumbnail
- duration: 9.216s
- poster: 2s
- transition_in: cut
- status: outline
- voiceover: Use our SDK and hooks to wire your client in minutes...
- blueprint: code-reveal
- asset_candidates: capture/screenshots/scroll-015.png
- src: compositions/frames/04-sdk-tease.html

Scene 1 (0–2s): `pnpm add @fluxy-chat/sdk` types in with cursor.
Scene 2 (2–4s): Console thumbnail slides up from bottom.

## Frame 5 — Demo CLI

- scene: Terminal running create-fluxy-chat scaffold
- duration: 6.955s
- poster: 4s
- transition_in: cut
- status: outline
- voiceover: Scaffold a project with one command...
- blueprint: terminal-demo
- asset_candidates: demos/cli-scaffold.mp4, capture/screenshots/scroll-015.png
- src: compositions/frames/05-demo-cli.html

Scene 1 (0–8s): Full-bleed terminal window; command types; success output scrolls.
Fallback: animate screenshot scroll-015 with terminal chrome overlay.

## Frame 6 — Demo realtime

- scene: Two browser tabs side-by-side, message sync
- duration: 8.043s
- poster: 4s
- transition_in: cut
- status: outline
- voiceover: Open two tabs. Message in one — it appears instantly in the other.
- blueprint: split-screen
- asset_candidates: demos/realtime-two-tabs.mp4, capture/screenshots/scroll-004.png
- src: compositions/frames/06-demo-realtime.html

Scene 1 (0–3s): Two tab frames slide in from sides.
Scene 2 (3–6s): Message typed in left tab; ping animation; appears in right tab.
Scene 3 (6–8s): "LIVE" badge pulses green.

## Frame 7 — Demo agent

- scene: @assistant invoke with visible tool call in timeline
- duration: 13.867s
- poster: 7s
- transition_in: cut
- status: outline
- voiceover: Now the part nobody else has. Type at-assistant...
- blueprint: feature-spotlight
- asset_candidates: demos/agent-tool-call.mp4, capture/screenshots/scroll-004.png
- src: compositions/frames/07-demo-agent.html

Scene 1 (0–4s): Chat input shows "@assistant summarize this room".
Scene 2 (4–8s): Agent response streams in same timeline (not sidebar).
Scene 3 (8–12s): Tool call card expands inline — function name + args visible.

## Frame 8 — Console + deploy

- scene: Dashboard glimpse + self-host vs hosted split
- duration: 7.403s
- poster: 2s
- transition_in: crossfade
- status: outline
- voiceover: Operator console for rooms, agents, and billing...
- blueprint: split-cta
- asset_candidates: demos/console-dashboard.mp4, capture/screenshots/scroll-026.png
- src: compositions/frames/08-console-deploy.html

Scene 1 (0–2s): Console screenshot push-in.
Scene 2 (2–4s): Two buttons: "Self-host" | "Hosted cloud".

## Frame 9 — CTA

- scene: fluxychat.com + open beta badge + QR placeholder
- duration: 6.08s
- poster: 2s
- transition_in: crossfade
- status: outline
- voiceover: FluxyChat is in open beta. MIT licensed. Try it at fluxychat.com.
- blueprint: end-card
- asset_candidates: capture/assets/svgs/logo-66f258ab.svg
- src: compositions/frames/09-cta.html

Scene 1 (0–2s): Logo + "Open Beta" badge scale in.
Scene 2 (2–4s): fluxychat.com URL + QR placeholder; orange CTA button pulse.
