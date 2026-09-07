import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "../components/marketing-shell";
import { HOSTED_PATHS, docsSiteHref } from "@/lib/hosted-product";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Ship FluxyChat in a SaaS",
  description: "Checklist for a startup or company putting rooms in the product. Not an enterprise MSA.",
  path: "/for-teams",
});

const KERNEL = [
  "Public room: FluxyRealtimeProvider + publishableKey (pk_) + useChat({ roomId }). Two tabs.",
  "Private room: mint a member JWT with POST /auth/token and X-Fluxy-Api-Key. fc_ stays on your server.",
  "Pin npm: @fluxy-chat/sdk ^0.6.12, @fluxy-chat/react ^0.1.7. Scaffold with npx @fluxy-chat/create-fluxy-chat@latest.",
  "Same room WebSocket for chat, presence, polls, and server_event. Yjs is a second binary socket on the same room.",
];

const BRING = [
  "Live video / huddle media: LiveKit or another SFU. FluxyChat is stage signaling only.",
  "WHIP / HLS ingest: Cloudflare Stream secrets on the Worker. Chat overlay does not need that.",
  "Bridges: you create the Slack/Discord/Telegram app. We store the binding.",
  "Wallet rooms: Worker GET/POST /auth/wallet with fc_ (SIWE + personal_sign). Token gates (NFT/balance) stay on your server.",
];

const COMPANY = [
  { href: "/terms", label: "Terms" },
  { href: "/dpa", label: "DPA" },
  { href: "/privacy-policy", label: "Privacy policy" },
  { href: "/subprocessors", label: "Subprocessors" },
  { href: "/status", label: "Status (Worker /health)" },
  { href: "/pricing", label: "Pricing (self-serve Free / Starter / Pro)" },
];

export default function ForTeamsPage() {
  return (
    <MarketingShell className="max-w-3xl py-12">
      <h1 className="font-heading text-3xl font-bold tracking-tight">Ship this in a product</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        For a startup or SaaS that owns the app. Hosted is open beta: pin versions, no public SLA.
        Self-host MIT if legal needs the Worker in your account. This is not an enterprise pack (SOC 2,
        HIPAA BAA, 99.999% SLA).
      </p>

      <h2 className="mt-10 font-heading text-lg font-semibold">Kernel (this is the product)</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
        {KERNEL.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 className="mt-10 font-heading text-lg font-semibold">You bring these</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
        {BRING.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 className="mt-10 font-heading text-lg font-semibold">Legal and ops for hosted</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
        {COMPANY.map((item) => (
          <li key={item.href}>
            <Link className="underline underline-offset-2" href={item.href}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-sm">
        <Link className="font-medium underline underline-offset-2" href={HOSTED_PATHS.getStarted}>
          Get started
        </Link>
        {" · "}
        <a className="font-medium underline underline-offset-2" href={docsSiteHref("getting-started/quickstart")}>
          Quickstart docs
        </a>
        {" · "}
        <Link className="font-medium underline underline-offset-2" href={HOSTED_PATHS.onboarding}>
          Console onboarding
        </Link>
      </p>
    </MarketingShell>
  );
}
