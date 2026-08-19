# FluxyChat Launch Video — Production Guide

Project folder: `videos/fluxychat-launch/`

## What's done

- HyperFrames skills installed (`npx skills add heygen-com/hyperframes --all --full-depth`)
- Site capture from fluxychat.com (brand, screenshots, fonts)
- `BRIEF.md`, `STORYBOARD.md`, `SCRIPT.md` — full 9-beat narrative
- Voiceover: Kokoro TTS (free, local) — 9 WAV files in `assets/voice/`
- 9 animated HTML frames in `compositions/frames/`
- Assembled `index.html` with crossfades + narration (~94s total)
- Render output: `renders/fluxychat-launch.mp4`

## Preview locally

```powershell
cd videos/fluxychat-launch
npm run dev
# open the URL printed in terminal
```

## Re-render after edits

```powershell
cd videos/fluxychat-launch
node scripts/build-frames.mjs
node ../.agents/skills/product-launch-video/scripts/assemble-index.mjs --storyboard ./STORYBOARD.md --hyperframes . --audio-meta ./audio_meta.json
node ../.agents/skills/product-launch-video/scripts/transitions.mjs inject --storyboard ./STORYBOARD.md --hyperframes .
npm run check
npx hyperframes render --output renders/fluxychat-launch.mp4 --quality high
```

## Cost breakdown (free vs paid)

| Component | Tool | Cost |
|-----------|------|------|
| Video composition + render | HyperFrames (local) | **Free** (Apache 2.0) |
| Voiceover (current) | Kokoro via `npx hyperframes tts` | **Free** |
| Voiceover (better + word timestamps) | HeyGen Starfish TTS | Free tier ~10 min/mo with OAuth login |
| BGM | HeyGen music library | Needs HeyGen sign-in |
| Avatar PiP (stock presenter) | HeyGen AI Studio / Video Agent | Uses credits; free tier limited |
| Captions (karaoke) | Requires word timestamps | HeyGen TTS or Whisper transcribe |

Sign in for HeyGen features: `npx hyperframes auth login`

## Next: replace placeholder demos with real screen recordings

Record these and drop into `demos/` then update frames 5–8:

1. **`demos/cli-scaffold.mp4`** — `npx create-fluxy-chat@latest` in real terminal (~8s)
2. **`demos/realtime-two-tabs.mp4`** — two browser tabs, instant message sync (~8s)
3. **`demos/agent-tool-call.mp4`** — `@assistant` with visible tool call in timeline (~12s) **← money shot**
4. **`demos/console-dashboard.mp4`** — operator console (~4s)
5. **`demos/self-host-hosted.png`** — self-host vs hosted buttons

Use OBS or Windows Game Bar (Win+G). 1920×1080, 30fps, MP4.

To use video in frames: mark clip with `data-frame-video="approved"` on a root-level `<video>` in `index.html` (sub-composition `<video>` tags render blank — hoist to index per HyperFrames rules).

## Next: avatar PiP (not you — stock presenter)

**Recommended workflow (founder-driven style, without being on camera):**

1. Go to [heygen.com](https://www.heygen.com) → AI Studio
2. Pick a **stock avatar** (not a digital twin)
3. Paste `SCRIPT.md` lines (or full script)
4. Export talking-head MP4 → `avatar/presenter.mp4`
5. Composite bottom-right in HyperFrames:
   - Option A: add root-level `<video>` in `index.html` during hook/solution beats only
   - Option B: use `/talking-head-recut` skill with PiP layout (`references/layouts/pip.html`)

Position: bottom-right, ~320×180, rounded corners, visible during frames 1–4, hidden during full-screen demo montage.

## Social cuts (LinkedIn / X)

Master is 16:9 (`1920×1080`). For social:

| Platform | Aspect | Suggestion |
|----------|--------|------------|
| LinkedIn feed | 16:9 or 1:1 | Use full master or crop hook + CTA (0:00–0:26 + last 10s) |
| X / Twitter | 16:9 | Same master, keep under 2:20 |
| Reels / Shorts | 9:16 | Re-compose with `/general-video` or crop center in CapCut |

Quick 30s teaser: frames 1 + 7 + 9 only (~38s → trim in editor).

## Script beats (for reference)

| Time | Beat |
|------|------|
| 0:00 | Hook — REST easy, realtime/AI hard |
| 0:18 | FluxyChat — one timeline, visible tool calls |
| 0:30 | Cloudflare Workers + DO + D1 |
| 0:42 | SDK + console tease |
| 0:51 | Demo: CLI scaffold |
| 0:58 | Demo: two-tab realtime |
| 1:06 | Demo: @assistant + tool call |
| 1:20 | Console + self-host vs hosted |
| 1:28 | CTA — fluxychat.com, open beta |
