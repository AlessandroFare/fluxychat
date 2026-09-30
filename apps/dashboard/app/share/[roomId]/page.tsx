import { Suspense } from "react";
import type { Metadata } from "next";
import { MarketingShell } from "../../components/marketing-shell";
import { buildPageMetadata } from "@/lib/site-metadata";
import { PublicShareLiveView } from "./public-share-live-view";

export const metadata: Metadata = buildPageMetadata({
  title: "Live room",
  description:
    "Read-only live view of a public FluxyChat room. The URL uses an unguessable share token, not the room id.",
  path: "/share",
  index: false,
});

export default function PublicSharePage() {
  return (
    <MarketingShell className="max-w-3xl pb-16">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading share…</p>}>
        <PublicShareLiveView />
      </Suspense>
    </MarketingShell>
  );
}
