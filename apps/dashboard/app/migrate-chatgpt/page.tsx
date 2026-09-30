import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "../components/marketing-shell";
import { HOSTED_PATHS, docsSiteHref } from "@/lib/hosted-product";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Import a ChatGPT export",
  description:
    "Drop a conversations.json you already downloaded into a FluxyChat room. Not a live OpenAI sync.",
  path: "/migrate-chatgpt",
});

export default function MigrateChatgptPage() {
  return (
    <MarketingShell className="max-w-3xl py-12">
      <h1 className="font-heading text-3xl font-bold tracking-tight">Import ChatGPT or Claude JSON</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        OpenAI is shutting group chats to new groups and putting existing ones read-only on their
        schedule. That is their product. Ours is a room Durable Object you run. If you already have
        a <code>conversations.json</code> download, you can load it into a group room here.
      </p>

      <h2 className="mt-10 font-heading text-lg font-semibold">How it works</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
        <li>One shot. First non-empty ChatGPT conversation in the file, cap 400 messages.</li>
        <li>Claude dumps with <code>chat_messages</code> use the same route.</li>
        <li>
          In the console: Rooms, then Import ChatGPT/Claude JSON. Over HTTP:{" "}
          <code>POST /rooms/import-transcript</code> with a member JWT.
        </li>
      </ul>

      <h2 className="mt-10 font-heading text-lg font-semibold">What we skip</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
        <li>We are not trying to replace ChatGPT.</li>
        <li>No live pull from OpenAI. We do not scrape your account.</li>
        <li>No email invites. Pass FluxyChat user ids only if those people already exist.</li>
      </ul>

      <p className="mt-10 text-sm">
        <Link className="font-medium underline underline-offset-2" href={HOSTED_PATHS.getStarted}>
          Get started
        </Link>
        {" · "}
        <a className="font-medium underline underline-offset-2" href={docsSiteHref("guides/import-transcript")}>
          Import docs
        </a>
        {" · "}
        <Link className="font-medium underline underline-offset-2" href={HOSTED_PATHS.console}>
          Console
        </Link>
      </p>
    </MarketingShell>
  );
}
