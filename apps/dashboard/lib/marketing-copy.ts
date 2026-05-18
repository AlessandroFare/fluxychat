/**
 * Marketing UX copy and per-route SEO (avoids keyword cannibalization between /landing, /get-started, /docs).
 */

import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/site-metadata";

export const SITE_DESCRIPTION =
  "Realtime in-app chat on the edge. SDK, AI agents, and operator console for Cloudflare Workers.";

export const PAGE_METADATA = {
  landing: buildPageMetadata({
    title: "In-app chat SDK for Cloudflare",
    description:
      "Add realtime rooms, agents, and webhooks with @fluxy-chat/sdk. Start on hosted cloud or deploy the Worker in your Cloudflare account.",
    path: "/landing",
  }),
  why: buildPageMetadata({
    title: "Why Fluxychat",
    description:
      "Why chat on Cloudflare Workers, what hosted vs self-host means, and where Fluxychat fits next to Stream, TalkJS, and the rest.",
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
