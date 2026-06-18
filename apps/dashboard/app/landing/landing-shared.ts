import { HOSTED_PATHS } from "@/lib/hosted-product";
import type { TopNavLink } from "../components/top-nav-mobile-menu";

export const INSTALL_CMD = "pnpm add @fluxy-chat/sdk";

export const STACK_LOGOS = [
  "Next.js",
  "React",
  "Vue",
  "Vite",
  "Node",
  "Workers",
  "React Native",
  "Svelte",
  "Remix",
  "TanStack",
  "Express",
  "Fastify",
] as const;

export const LANDING_BADGES = [
  {
    id: "product-hunt",
    href: "https://www.producthunt.com/products/fluxychat?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-fluxychat",
    imgSrc:
      "https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1155224&theme=dark&t=1779972380375",
    alt: "Fluxychat - Realtime chat API on Cloudflare — hosted or self-host | Product Hunt",
    width: 250,
    height: 54,
  },
  {
    id: "saashub",
    href: "https://www.saashub.com/fluxychat?utm_source=badge&utm_campaign=badge&utm_content=fluxychat&badge_variant=color&badge_kind=approved",
    imgSrc: "https://cdn-b.saashub.com/img/badges/approved-color.png?v=1",
    alt: "Fluxychat badge (SaaSHub approved)",
    width: 150,
    height: 45,
  },
  {
    id: "sideprojectors",
    href: "https://www.sideprojectors.com/project/80991/fluxychat",
    imgSrc: "https://www.sideprojectors.com/img/badges/badge_show_black.png",
    alt: "Check out Fluxychat at SideProjectors",
    width: 200,
    height: 40,
  },
] as const;

export const LANDING_NAV_LINKS: readonly TopNavLink[] = [
  { href: HOSTED_PATHS.docs, label: "Docs" },
  { href: HOSTED_PATHS.why, label: "Why" },
  { href: "#pricing", label: "Pricing" },
  { href: HOSTED_PATHS.compare, label: "Compare" },
  { href: HOSTED_PATHS.guides, label: "Guides" },
  { href: "#lifecycle", label: "Lifecycle" },
  { href: "/demo", label: "Demo" },
  { href: "#faq", label: "FAQ" },
  { href: HOSTED_PATHS.status, label: "Status" },
];

export const LANDING_MOBILE_MENU_ID = "landing-mobile-menu";

