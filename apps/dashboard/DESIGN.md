---
version: alpha
name: FluxyChat
description: Dark cinematic marketing plus crafted orange brand. Console remains a separate operate surface.
colors:
  mkt-bg: "#0B0B0C"
  mkt-bg-elevated: "#121214"
  mkt-surface: "#171719"
  mkt-text: "#F4F4F5"
  mkt-text-muted: "#A1A1AA"
  mkt-border: "#FFFFFF14"
  brand: "#FF6A1A"
  brand-soft: "#FF8A47"
typography:
  sans:
    fontFamily: Geist
  heading:
    fontFamily: Syne
  mono:
    fontFamily: Geist Mono
rounded:
  base: 0.5rem
---

## Overview

FluxyChat marketing persuades technical buyers to start a hosted or self-hosted chat stack. Marketing is dark cinematic with orange brand. Product console stays a separate operate surface with light default.

## Colors

Use brand orange for primary actions and one accent per view. Do not use purple or multicolor gradients as identity. Secondary text on dark surfaces is zinc, not gray-on-cream.

## Typography

Syne is display for marketing headings. Geist is UI and body. Geist Mono is CLI, code, and install commands. Headings use text-balance. Body uses text-pretty. Tabular nums for metrics.

## Layout

Marketing chrome lives under `#fc-marketing-root`. Keep existing landing section order and copy. Restyle surfaces rather than deleting blocks.

## Elevation & Depth

Prefer inset 1px highlight plus offset shadow over hard borders. Shadows have offset and blur.

## Components

Reuse existing marketing primitives (Grainient, SpotlightCard, FlowingMenu, BlurText). Hero may add a Three.js orbit field that pauses off-screen and respects reduced motion.

## Do's and Don'ts

- Do keep section content and existing motion, then restyle.
- Don't treat glass, glow, or AI-purple mesh as the brand.
- Don't animate layout properties or continuous blur on large surfaces.
- Don't autoplay media with sound.
