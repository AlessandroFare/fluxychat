/**
 * Marketing UX copy and per-route SEO (avoids keyword cannibalization between /landing, /get-started, /docs).
 */

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const SITE_DESCRIPTION =
  "AI-native chat SDK on Cloudflare for SaaS teams. 14 platform adapters, streaming AI, MCP tools, LLM middleware, and operator console. Self-host or hosted.";

export const PAGE_METADATA = {
  landing: buildPageMetadata({
    title: "AI-native chat SDK on Cloudflare — 14 platform adapters",
    description:
      "Add in-app chat, AI agents, and multi-platform messaging with @fluxy-chat/sdk. Streaming markdown, MCP tools, LLM middleware, WorkflowAgent — self-host on Workers or use hosted cloud.",
    path: "/landing",
  }),
  why: buildPageMetadata({
    title: "Why Fluxychat",
    description:
      "Why chat on Cloudflare Workers, hosted vs self-host, in-app chat vs support desk, and how FluxyChat compares to Pusher and Ably.",
    path: "/why",
  }),
  getStarted: buildPageMetadata({
    title: "Quickstart",
    description:
      "Create a Fluxychat account, install the SDK, and send your first room message on hosted cloud in a few steps.",
    path: "/get-started",
  }),
  docs: buildPageMetadata({
    title: "Documentation",
    description:
      "JWT auth, SDK setup, webhooks, operator console, and self-hosting on Cloudflare Workers.",
    path: "/docs",
  }),
  cloudflareWorkersChatGuide: buildPageMetadata({
    title: "Cloudflare Workers chat with Durable Objects",
    description:
      "Build instant messaging on Cloudflare Workers: WebSockets, Durable Objects, D1 — Pusher alternative without a VPS. Vercel front + edge chat.",
    path: "/guides/cloudflare-workers-chat",
  }),
  onboarding: buildPageMetadata({
    title: "Quickstart wizard",
    description:
      "Connect your account, mint JWTs, open a room, and send a test message on Fluxychat Cloud.",
    path: "/onboarding",
    index: false,
  }),
  privacy: buildPageMetadata({
    title: "Privacy and GDPR",
    description:
      "What Fluxychat stores, retention defaults, sub-processors, and how to export or erase data for your project.",
    path: "/privacy",
    index: false,
  }),
  enter: buildPageMetadata({
    title: "Console access",
    description:
      "Confirm you operate this Worker deployment before using projects, rooms, and billing in the console.",
    path: "/enter",
    index: false,
  }),
  signIn: buildPageMetadata({
    title: "Sign in",
    description: "Sign in to the Fluxychat operator console and hosted cloud.",
    path: "/sign-in",
    index: false,
  }),
  signUp: buildPageMetadata({
    title: "Sign up",
    description: "Create a Fluxychat account. We provision a project and API credentials on hosted cloud.",
    path: "/sign-up",
  }),
} satisfies Record<string, Metadata>;

