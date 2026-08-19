#!/usr/bin/env node
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FRAMES = join(ROOT, "compositions", "frames");
const ASSETS = join(ROOT, "assets");

const DUR = {
  "01-hook": 18.304,
  "02-solution": 12.053,
  "03-infrastructure": 11.861,
  "04-sdk-tease": 9.216,
  "05-demo-cli": 6.955,
  "06-demo-realtime": 8.043,
  "07-demo-agent": 13.867,
  "08-console-deploy": 7.403,
  "09-cta": 6.08,
};

function stageScreenshots() {
  mkdirSync(ASSETS, { recursive: true });
  const map = [
    ["hero.png", "capture/screenshots/scroll-000.png"],
    ["playground.png", "capture/screenshots/scroll-004.png"],
    ["sdk-steps.png", "capture/screenshots/scroll-015.png"],
    ["console.png", "capture/screenshots/scroll-026.png"],
    ["logo.svg", "capture/assets/svgs/logo-66f258ab.svg"],
  ];
  for (const [dest, src] of map) {
    const from = join(ROOT, src);
    const to = join(ASSETS, dest);
    if (existsSync(from)) copyFileSync(from, to);
  }
}

function frameShell(id, dur, css, body, timeline) {
  const px = `fx-${id}`;
  return `<template>
  <div id="root" data-composition-id="${id}" data-width="1920" data-height="1080" data-start="0" data-duration="${dur}">
    <div class="clip ${px}-bg" data-start="0" data-duration="${dur}" data-track-index="0"></div>
    ${body}
  </div>
  <style>
    @font-face {
      font-family: "Geist";
      src: url("assets/fonts/Geist-Regular.woff2") format("woff2");
      font-weight: 400;
      font-style: normal;
    }
    #root {
      position: relative;
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      font-family: "Geist", system-ui, sans-serif;
      color: #0E1316;
    }
    .${px}-bg {
      position: absolute;
      inset: 0;
      z-index: 0;
    }
    ${css.replaceAll("__PX__", px)}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <script>
    window.__timelines = window.__timelines || {};
    const tl = gsap.timeline({ paused: true });
    ${timeline}
    window.__timelines["${id}"] = tl;
  </script>
</template>
`;
}

const frames = {
  "01-hook": frameShell(
    "01-hook",
    DUR["01-hook"],
    `
    .01-hook-bg { background: linear-gradient(135deg, #020617 0%, #0E1316 100%); }
    .01-hook-grid {
      position: absolute; inset: 0; opacity: 0.08;
      background-image: linear-gradient(rgba(194,65,12,0.5) 1px, transparent 1px),
        linear-gradient(90deg, rgba(194,65,12,0.5) 1px, transparent 1px);
      background-size: 48px 48px;
    }
    .01-hook-card {
      position: absolute; left: 50%; top: 180px; width: 520px; margin-left: -260px;
      padding: 28px 36px; border-radius: 16px; background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12); color: #fff; text-align: center;
      font-size: 42px; font-weight: 600; letter-spacing: -0.02em;
    }
    .01-hook-card.accent { top: 340px; border-color: #c2410c; box-shadow: 0 0 40px rgba(194,65,12,0.25); }
    .01-hook-card.warn { top: 500px; font-size: 34px; color: #fbbf24; }
    .01-hook-card.dark { top: 640px; font-size: 30px; color: #94a3b8; }
    .01-hook-stamp {
      position: absolute; right: 120px; top: 620px; padding: 12px 24px;
      background: #dc2626; color: #fff; font-size: 28px; font-weight: 700;
      transform: rotate(-8deg); border-radius: 8px;
    }
    .01-hook-label {
      position: absolute; left: 80px; top: 80px; color: #c2410c; font-size: 14px;
      letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600;
    }`,
    `
    <div class="01-hook-grid"></div>
    <div class="01-hook-label">The problem</div>
    <div class="01-hook-card" id="01-hook-c1">REST API</div>
    <div class="01-hook-card accent" id="01-hook-c2">WebSockets</div>
    <div class="01-hook-card warn" id="01-hook-c3">AI in chat?</div>
    <div class="01-hook-stamp" id="01-hook-stamp">$$$ VENDORS</div>`,
    `
    gsap.set("#01-hook-c1", { opacity: 0, y: 60, scale: 0.9 });
    gsap.set("#01-hook-c2", { opacity: 0, x: -120 });
    gsap.set("#01-hook-c3", { opacity: 0, scale: 0.7 });
    gsap.set("#01-hook-stamp", { opacity: 0, scale: 2, rotation: -20 });
    tl.fromTo("#01-hook-c1", { opacity: 0, y: 60, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.4)" }, 0.3);
    tl.fromTo("#01-hook-c2", { opacity: 0, x: -120 }, { opacity: 1, x: 0, duration: 0.55, ease: "power3.out" }, 2.2);
    tl.fromTo("#01-hook-c3", { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.2)" }, 5.0);
    tl.fromTo("#01-hook-stamp", { opacity: 0, scale: 2, rotation: -20 }, { opacity: 1, scale: 1, rotation: -8, duration: 0.35, ease: "power2.out" }, 8.0);
    tl.to("#01-hook-c1, #01-hook-c2, #01-hook-c3", { x: -40, scale: 0.92, opacity: 0.7, duration: 0.8, stagger: 0.08 }, 14.0);`,
  ),

  "02-solution": frameShell(
    "02-solution",
    DUR["02-solution"],
    `
    .02-solution-bg { background: #FDFBF9; }
    .02-solution-logo { position: absolute; left: 80px; top: 72px; width: 48px; height: 48px; }
    .02-solution-title {
      position: absolute; left: 140px; top: 78px; font-size: 36px; font-weight: 700; color: #0E1316;
    }
    .02-solution-headline {
      position: absolute; left: 80px; top: 180px; width: 900px; font-size: 72px; font-weight: 700;
      line-height: 1.05; letter-spacing: -0.03em; color: #0E1316;
    }
    .02-solution-headline span { color: #c2410c; }
    .02-solution-rail {
      position: absolute; left: 80px; top: 520px; width: 1760px; height: 280px;
      background: #fff; border: 1px solid #e5e0d8; border-radius: 20px;
      box-shadow: 0 20px 60px rgba(14,19,22,0.08); padding: 32px 40px;
    }
    .02-solution-msg {
      display: flex; align-items: center; gap: 16px; margin-bottom: 20px; font-size: 22px;
    }
    .02-solution-msg.human .02-solution-avatar { background: #3b82f6; }
    .02-solution-msg.agent .02-solution-avatar { background: #c2410c; }
    .02-solution-avatar {
      width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
    }
    .02-solution-tool {
      margin-left: 52px; padding: 12px 16px; background: #F3F0EC; border-left: 3px solid #c2410c;
      border-radius: 8px; font-family: ui-monospace, monospace; font-size: 16px; color: #475569;
    }
    .02-solution-badges { position: absolute; right: 80px; top: 200px; display: flex; gap: 12px; }
    .02-solution-badge {
      padding: 10px 18px; border-radius: 999px; font-size: 14px; font-weight: 600;
      letter-spacing: 0.06em; text-transform: uppercase;
    }
    .02-solution-badge.oss { background: rgba(194,65,12,0.1); color: #c2410c; }
    .02-solution-badge.mit { background: #0E1316; color: #fff; }`,
    `
    <img class="02-solution-logo" id="02-solution-logo" src="../../assets/logo.svg" alt="" />
    <div class="02-solution-title" id="02-solution-brand">FluxyChat</div>
    <div class="02-solution-headline" id="02-solution-h1">Chat + agents.<br><span>One timeline.</span></div>
    <div class="02-solution-badges">
      <div class="02-solution-badge oss" id="02-solution-b1">Open source</div>
      <div class="02-solution-badge mit" id="02-solution-b2">MIT</div>
    </div>
    <div class="02-solution-rail" id="02-solution-rail">
      <div class="02-solution-msg human" id="02-solution-m1">
        <div class="02-solution-avatar"></div><div>@assistant summarize this room</div>
      </div>
      <div class="02-solution-msg agent" id="02-solution-m2">
        <div class="02-solution-avatar"></div><div>On it — checking room history…</div>
      </div>
      <div class="02-solution-tool" id="02-solution-tool">tool_call · search_messages · { roomId: "…" }</div>
    </div>`,
    `
    gsap.set("#02-solution-logo, #02-solution-brand", { opacity: 0, y: -20 });
    gsap.set("#02-solution-h1", { opacity: 0, y: 40 });
    gsap.set("#02-solution-rail", { opacity: 0, y: 60 });
    gsap.set("#02-solution-m1, #02-solution-m2, #02-solution-tool", { opacity: 0, x: -30 });
    gsap.set("#02-solution-b1, #02-solution-b2", { opacity: 0, scale: 0.8 });
    tl.fromTo("#02-solution-logo, #02-solution-brand", { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.5 }, 0.2);
    tl.fromTo("#02-solution-h1", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0.8);
    tl.fromTo("#02-solution-rail", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.6 }, 3.0);
    tl.fromTo("#02-solution-m1", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.4 }, 3.4);
    tl.fromTo("#02-solution-m2", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.4 }, 5.2);
    tl.fromTo("#02-solution-tool", { opacity: 0, x: -30 }, { opacity: 1, x: 0, duration: 0.45, ease: "back.out(1.2)" }, 7.0);
    tl.fromTo("#02-solution-b1", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.35 }, 9.5);
    tl.fromTo("#02-solution-b2", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.35 }, 10.0);`,
  ),

  "03-infrastructure": frameShell(
    "03-infrastructure",
    DUR["03-infrastructure"],
    `
    .03-infrastructure-bg { background: #FDFBF9; }
    .03-infrastructure-title {
      position: absolute; left: 80px; top: 80px; font-size: 56px; font-weight: 700;
      letter-spacing: -0.02em; max-width: 800px;
    }
    .03-infrastructure-nodes { position: absolute; left: 80px; top: 280px; display: flex; gap: 32px; }
    .03-infrastructure-node {
      width: 320px; padding: 32px; border-radius: 16px; background: #fff;
      border: 1px solid #e5e0d8; box-shadow: 0 8px 32px rgba(14,19,22,0.06);
    }
    .03-infrastructure-node h3 { font-size: 22px; margin-bottom: 8px; color: #c2410c; }
    .03-infrastructure-node p { font-size: 16px; color: #475569; line-height: 1.5; }
    .03-infrastructure-globe {
      position: absolute; right: 100px; top: 200px; width: 480px; height: 480px;
      border-radius: 50%; border: 2px dashed rgba(194,65,12,0.3);
      display: flex; align-items: center; justify-content: center; font-size: 18px;
      color: #c2410c; letter-spacing: 0.12em; text-transform: uppercase;
    }
    .03-infrastructure-paths {
      position: absolute; left: 80px; bottom: 120px; display: flex; gap: 24px;
    }
    .03-infrastructure-path {
      padding: 20px 36px; border-radius: 12px; font-size: 24px; font-weight: 600;
    }
    .03-infrastructure-path.self { background: #0E1316; color: #fff; }
    .03-infrastructure-path.hosted { background: #c2410c; color: #fff; }`,
    `
    <div class="03-infrastructure-title" id="03-inf-title">Built on Cloudflare's edge</div>
    <div class="03-infrastructure-nodes">
      <div class="03-infrastructure-node" id="03-inf-n1"><h3>Workers</h3><p>HTTP + WebSocket at the edge</p></div>
      <div class="03-infrastructure-node" id="03-inf-n2"><h3>Durable Objects</h3><p>Stateful rooms & presence</p></div>
      <div class="03-infrastructure-node" id="03-inf-n3"><h3>D1</h3><p>Messages & metadata</p></div>
    </div>
    <div class="03-infrastructure-globe" id="03-inf-globe">Globally distributed</div>
    <div class="03-infrastructure-paths">
      <div class="03-infrastructure-path self" id="03-inf-self">Self-host</div>
      <div class="03-infrastructure-path hosted" id="03-inf-hosted">Hosted by us</div>
    </div>`,
    `
    gsap.set("#03-inf-title", { opacity: 0, y: 30 });
    gsap.set("#03-inf-n1, #03-inf-n2, #03-inf-n3", { opacity: 0, y: 50 });
    gsap.set("#03-inf-globe", { opacity: 0, scale: 0.6 });
    gsap.set("#03-inf-self, #03-inf-hosted", { opacity: 0, y: 30 });
    tl.fromTo("#03-inf-title", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5 }, 0.3);
    tl.fromTo("#03-inf-n1", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.45 }, 1.5);
    tl.fromTo("#03-inf-n2", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.45 }, 2.2);
    tl.fromTo("#03-inf-n3", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.45 }, 2.9);
    tl.fromTo("#03-inf-globe", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.8, ease: "power2.out" }, 4.5);
    tl.to("#03-inf-globe", { rotation: 360, duration: 8, ease: "none" }, 5.0);
    tl.fromTo("#03-inf-self", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4 }, 8.5);
    tl.fromTo("#03-inf-hosted", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.4 }, 9.2);`,
  ),

  "04-sdk-tease": frameShell(
    "04-sdk-tease",
    DUR["04-sdk-tease"],
    `
    .04-sdk-tease-bg { background: #020617; }
    .04-sdk-tease-terminal {
      position: absolute; left: 80px; top: 120px; width: 900px; padding: 24px;
      background: #0f172a; border-radius: 12px; border: 1px solid #1e293b;
      font-family: ui-monospace, monospace; font-size: 22px; color: #e2e8f0;
    }
    .04-sdk-tease-prompt { color: #4ade80; }
    .04-sdk-tease-cursor {
      display: inline-block; width: 12px; height: 24px; background: #c2410c; margin-left: 4px;
      vertical-align: middle;
    }
    .04-sdk-tease-shot {
      position: absolute; right: 60px; top: 100px; width: 780px; height: 440px;
      border-radius: 16px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);
      box-shadow: 0 24px 80px rgba(0,0,0,0.5);
    }
    .04-sdk-tease-shot img { width: 100%; height: 100%; object-fit: cover; object-position: top; }`,
    `
    <div class="04-sdk-tease-terminal" id="04-sdk-term">
      <span class="04-sdk-tease-prompt">$</span> <span id="04-sdk-cmd"></span><span class="04-sdk-tease-cursor" id="04-sdk-cursor"></span>
    </div>
    <div class="04-sdk-tease-shot" id="04-sdk-shot">
      <img src="assets/sdk-steps.png" alt="" />
    </div>`,
    `
    const cmd = "pnpm add @fluxy-chat/sdk";
    gsap.set("#04-sdk-term", { opacity: 0, y: 20 });
    gsap.set("#04-sdk-shot", { opacity: 0, x: 80 });
    gsap.set("#04-sdk-cursor", { opacity: 1 });
    tl.fromTo("#04-sdk-term", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, 0.2);
    for (let i = 0; i <= cmd.length; i++) {
      const slice = cmd.slice(0, i);
      tl.call(() => { document.getElementById("04-sdk-cmd").textContent = slice; }, null, 0.8 + i * 0.06);
    }
    tl.to("#04-sdk-cursor", { opacity: 0, duration: 0.1, repeat: 5, yoyo: true, repeatDelay: 0.4 }, 0.8);
    tl.fromTo("#04-sdk-shot", { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 0.7, ease: "power3.out" }, 4.5);`,
  ),

  "05-demo-cli": frameShell(
    "05-demo-cli",
    DUR["05-demo-cli"],
    `
    .05-demo-cli-bg { background: #0E1316; }
    .05-demo-cli-window {
      position: absolute; left: 120px; top: 80px; width: 1680px; height: 920px;
      background: #18181b; border-radius: 12px; border: 1px solid #27272a; overflow: hidden;
    }
    .05-demo-cli-bar {
      height: 40px; background: #27272a; display: flex; align-items: center; padding: 0 16px; gap: 8px;
    }
    .05-demo-cli-dot { width: 12px; height: 12px; border-radius: 50%; }
    .05-demo-cli-body {
      padding: 32px; font-family: ui-monospace, monospace; font-size: 20px; color: #a1a1aa; line-height: 1.8;
    }
    .05-demo-cli-line { color: #fafafa; }
    .05-demo-cli-success { color: #4ade80; }`,
    `
    <div class="05-demo-cli-window" id="05-cli-win">
      <div class="05-demo-cli-bar">
        <div class="05-demo-cli-dot" style="background:#ef4444"></div>
        <div class="05-demo-cli-dot" style="background:#fbbf24"></div>
        <div class="05-demo-cli-dot" style="background:#22c55e"></div>
      </div>
      <div class="05-demo-cli-body">
        <div id="05-cli-l1" class="05-demo-cli-line">$ npx create-fluxy-chat@latest my-app</div>
        <div id="05-cli-l2">Creating project…</div>
        <div id="05-cli-l3" class="05-demo-cli-success">✓ Done in 4.2s — cd my-app && pnpm dev</div>
      </div>
    </div>`,
    `
    gsap.set("#05-cli-win", { opacity: 0, scale: 0.96 });
    gsap.set("#05-cli-l1, #05-cli-l2, #05-cli-l3", { opacity: 0 });
    tl.fromTo("#05-cli-win", { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.5 }, 0.2);
    tl.fromTo("#05-cli-l1", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.0);
    tl.fromTo("#05-cli-l2", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 2.5);
    tl.fromTo("#05-cli-l3", { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "back.out(1.2)" }, 4.5);`,
  ),

  "06-demo-realtime": frameShell(
    "06-demo-realtime",
    DUR["06-demo-realtime"],
    `
    .06-demo-realtime-bg { background: #020617; }
    .06-demo-realtime-tabs { position: absolute; inset: 60px 80px; display: flex; gap: 24px; }
    .06-demo-realtime-tab {
      flex: 1; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden;
    }
    .06-demo-realtime-tabbar {
      padding: 12px 16px; background: #1e293b; font-size: 14px; color: #94a3b8;
    }
    .06-demo-realtime-chat { padding: 24px; }
    .06-demo-realtime-bubble {
      max-width: 80%; padding: 14px 18px; border-radius: 14px; margin-bottom: 12px; font-size: 18px;
    }
    .06-demo-realtime-bubble.sent { background: #c2410c; color: #fff; margin-left: auto; }
    .06-demo-realtime-bubble.recv { background: #334155; color: #f1f5f9; }
    .06-demo-realtime-live {
      position: absolute; top: 40px; right: 100px; padding: 8px 16px; background: #16a34a;
      color: #fff; border-radius: 999px; font-size: 14px; font-weight: 700; letter-spacing: 0.1em;
    }`,
    `
    <div class="06-demo-realtime-live" id="06-rt-live">● LIVE</div>
    <div class="06-demo-realtime-tabs">
      <div class="06-demo-realtime-tab" id="06-rt-tab1">
        <div class="06-demo-realtime-tabbar">Tab A — User 1</div>
        <div class="06-demo-realtime-chat">
          <div class="06-demo-realtime-bubble sent" id="06-rt-msg">Hey — realtime check ✓</div>
        </div>
      </div>
      <div class="06-demo-realtime-tab" id="06-rt-tab2">
        <div class="06-demo-realtime-tabbar">Tab B — User 2</div>
        <div class="06-demo-realtime-chat">
          <div class="06-demo-realtime-bubble recv" id="06-rt-echo"></div>
        </div>
      </div>
    </div>`,
    `
    gsap.set("#06-rt-tab1", { opacity: 0, x: -60 });
    gsap.set("#06-rt-tab2", { opacity: 0, x: 60 });
    gsap.set("#06-rt-live", { opacity: 0, scale: 0.8 });
    gsap.set("#06-rt-msg", { opacity: 0 });
    gsap.set("#06-rt-echo", { opacity: 0, scale: 0.9 });
    tl.fromTo("#06-rt-tab1", { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.5 }, 0.3);
    tl.fromTo("#06-rt-tab2", { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.5 }, 0.5);
    tl.fromTo("#06-rt-msg", { opacity: 0 }, { opacity: 1, duration: 0.35 }, 2.0);
    tl.fromTo("#06-rt-echo", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(2)" }, 3.2);
    tl.call(() => { document.getElementById("06-rt-echo").textContent = "Hey — realtime check ✓"; }, null, 3.2);
    tl.fromTo("#06-rt-live", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.35 }, 4.5);
    tl.to("#06-rt-live", { scale: 1.05, duration: 0.6, repeat: 3, yoyo: true, ease: "sine.inOut" }, 5.0);`,
  ),

  "07-demo-agent": frameShell(
    "07-demo-agent",
    DUR["07-demo-agent"],
    `
    .07-demo-agent-bg { background: #FDFBF9; }
    .07-demo-agent-wrap {
      position: absolute; left: 80px; top: 60px; width: 1760px; height: 960px;
      border-radius: 20px; overflow: hidden; border: 1px solid #e5e0d8;
      box-shadow: 0 24px 80px rgba(14,19,22,0.12);
    }
    .07-demo-agent-wrap img { width: 100%; height: 55%; object-fit: cover; object-position: top; }
    .07-demo-agent-overlay {
      position: absolute; left: 0; right: 0; bottom: 0; height: 45%; background: #fff; padding: 32px 40px;
    }
    .07-demo-agent-input {
      padding: 16px 20px; background: #F3F0EC; border-radius: 12px; font-size: 20px; margin-bottom: 20px;
      border: 2px solid #c2410c;
    }
    .07-demo-agent-reply { font-size: 18px; color: #475569; margin-bottom: 16px; }
    .07-demo-agent-tool {
      padding: 16px 20px; background: #0E1316; color: #4ade80; border-radius: 10px;
      font-family: ui-monospace, monospace; font-size: 16px;
    }
    .07-demo-agent-highlight {
      position: absolute; left: 80px; top: 24px; z-index: 20; padding: 12px 20px; background: #c2410c; color: #fff;
      border-radius: 8px; font-weight: 700; font-size: 16px; letter-spacing: 0.05em;
    }`,
    `
    <div class="07-demo-agent-highlight" id="07-ag-hl">KEY DIFFERENTIATOR</div>
    <div class="07-demo-agent-wrap" id="07-ag-wrap">
      <img src="assets/playground.png" alt="" />
      <div class="07-demo-agent-overlay">
        <div class="07-demo-agent-input" id="07-ag-in">@assistant list active tools in this room</div>
        <div class="07-demo-agent-reply" id="07-ag-reply">I'll check what's available and run the search…</div>
        <div class="07-demo-agent-tool" id="07-ag-tool">⟫ tool_call search_messages({"query":"…"})</div>
      </div>
    </div>`,
    `
    gsap.set("#07-ag-wrap", { opacity: 0, y: 40 });
    gsap.set("#07-ag-hl", { opacity: 0, x: 40 });
    gsap.set("#07-ag-in, #07-ag-reply, #07-ag-tool", { opacity: 0, y: 20 });
    tl.fromTo("#07-ag-wrap", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6 }, 0.3);
    tl.fromTo("#07-ag-hl", { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.4 }, 1.0);
    tl.fromTo("#07-ag-in", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, 2.5);
    tl.fromTo("#07-ag-reply", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, 5.0);
    tl.fromTo("#07-ag-tool", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "back.out(1.3)" }, 7.5);
    tl.to("#07-ag-tool", { boxShadow: "0 0 30px rgba(74,222,128,0.4)", duration: 0.8, repeat: 2, yoyo: true }, 9.0);`,
  ),

  "08-console-deploy": frameShell(
    "08-console-deploy",
    DUR["08-console-deploy"],
    `
    .08-console-deploy-bg { background: #F3F0EC; }
    .08-console-deploy-shot {
      position: absolute; left: 80px; top: 60px; width: 1100px; height: 620px;
      border-radius: 16px; overflow: hidden; border: 1px solid #e5e0d8;
      box-shadow: 0 16px 48px rgba(14,19,22,0.1);
    }
    .08-console-deploy-shot img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
    .08-console-deploy-choices {
      position: absolute; right: 80px; top: 200px; width: 520px;
    }
    .08-console-deploy-choice {
      padding: 32px; border-radius: 16px; margin-bottom: 20px; font-size: 28px; font-weight: 700;
    }
    .08-console-deploy-choice.self { background: #0E1316; color: #fff; }
    .08-console-deploy-choice.hosted { background: #c2410c; color: #fff; }`,
    `
    <div class="08-console-deploy-shot" id="08-cd-shot">
      <img src="assets/console.png" alt="" />
    </div>
    <div class="08-console-deploy-choices">
      <div class="08-console-deploy-choice self" id="08-cd-self">Self-host on Cloudflare</div>
      <div class="08-console-deploy-choice hosted" id="08-cd-hosted">Hosted in seconds</div>
    </div>`,
    `
    gsap.set("#08-cd-shot", { opacity: 0, x: -40 });
    gsap.set("#08-cd-self, #08-cd-hosted", { opacity: 0, x: 40 });
    tl.fromTo("#08-cd-shot", { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.5 }, 0.3);
    tl.fromTo("#08-cd-self", { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.45 }, 2.0);
    tl.fromTo("#08-cd-hosted", { opacity: 0, x: 40 }, { opacity: 1, x: 0, duration: 0.45 }, 3.0);`,
  ),

  "09-cta": frameShell(
    "09-cta",
    DUR["09-cta"],
    `
    .09-cta-bg { background: linear-gradient(135deg, #FDFBF9 0%, #F3F0EC 100%); }
    .09-cta-logo { position: absolute; left: 50%; top: 200px; width: 80px; height: 80px; margin-left: -40px; }
    .09-cta-badge {
      position: absolute; left: 50%; top: 300px; transform: translateX(-50%);
      padding: 10px 24px; background: #c2410c; color: #fff; border-radius: 999px;
      font-size: 16px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    }
    .09-cta-url {
      position: absolute; left: 50%; top: 420px; transform: translateX(-50%);
      font-size: 64px; font-weight: 700; color: #0E1316; letter-spacing: -0.02em;
    }
    .09-cta-sub {
      position: absolute; left: 50%; top: 520px; transform: translateX(-50%);
      font-size: 24px; color: #475569;
    }
    .09-cta-qr {
      position: absolute; right: 200px; top: 380px; width: 140px; height: 140px;
      background: #0E1316; border-radius: 12px;
      background-image: linear-gradient(90deg, #fff 2px, transparent 2px),
        linear-gradient(#fff 2px, transparent 2px);
      background-size: 14px 14px; opacity: 0.9;
    }
    .09-cta-btn {
      position: absolute; left: 50%; top: 620px; transform: translateX(-50%);
      padding: 18px 48px; background: #c2410c; color: #fff; border-radius: 12px;
      font-size: 22px; font-weight: 600;
    }`,
    `
    <img class="09-cta-logo" id="09-cta-logo" src="../../assets/logo.svg" alt="" />
    <div class="09-cta-badge" id="09-cta-badge">Open Beta</div>
    <div class="09-cta-url" id="09-cta-url">fluxychat.com</div>
    <div class="09-cta-sub" id="09-cta-sub">MIT licensed · Self-hostable</div>
    <div class="09-cta-qr" id="09-cta-qr"></div>
    <div class="09-cta-btn" id="09-cta-btn">Start free →</div>`,
    `
    gsap.set("#09-cta-logo, #09-cta-badge, #09-cta-url, #09-cta-sub, #09-cta-qr, #09-cta-btn", { opacity: 0, y: 30 });
    tl.fromTo("#09-cta-logo", { opacity: 0, y: 30, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "back.out(1.4)" }, 0.2);
    tl.fromTo("#09-cta-badge", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35 }, 0.6);
    tl.fromTo("#09-cta-url", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5 }, 1.0);
    tl.fromTo("#09-cta-sub", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35 }, 1.5);
    tl.fromTo("#09-cta-qr", { opacity: 0, scale: 0.5 }, { opacity: 0.9, scale: 1, duration: 0.45 }, 2.0);
    tl.fromTo("#09-cta-btn", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 }, 2.8);
    tl.to("#09-cta-btn", { scale: 1.05, duration: 0.5, repeat: 2, yoyo: true, ease: "sine.inOut" }, 3.5);`,
  ),
};

function fixFrameHtml(id, html) {
  const px = `fx-${id}`;
  let out = html
    .replaceAll(`../../assets/`, `assets/`)
    .replaceAll(`class="${id}-`, `class="${px}-`)
    .replaceAll(`.${id}-`, `.${px}-`)
    .replaceAll(`id="${id}-`, `id="${px}-`)
    .replaceAll(`#${id}-`, `#${px}-`);
  // Prefix bare numeric ids (e.g. 03-inf-title) — avoid matching data-composition-id
  out = out.replace(/(?<![-\w])id="(\d[^"]*)"/g, (_, raw) => {
    const next = raw.startsWith("el-") ? raw : `el-${raw}`;
    return `id="${next}"`;
  });
  out = out.replace(/#(\d[\w-]*)/g, (_, raw) => `#el-${raw}`);
  return out;
}

stageScreenshots();
mkdirSync(FRAMES, { recursive: true });

for (const [id, html] of Object.entries(frames)) {
  writeFileSync(join(FRAMES, `${id}.html`), fixFrameHtml(id, html), "utf8");
  console.log(`✓ ${id}.html (${DUR[id]}s)`);
}

console.log(`\nBuilt ${Object.keys(frames).length} frames.`);
