import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "../components/marketing-shell";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { buildPageMetadata } from "@/lib/site-metadata";
import { DsaReportForm } from "./dsa-report-form";

export const metadata: Metadata = buildPageMetadata({
  title: "Report illegal content — FluxyChat",
  description:
    "Notice-and-action form for hosted FluxyChat share pages. Hosting duties under the EU DSA. Not legal advice.",
  path: "/report",
});

export default function ReportPage() {
  return (
    <MarketingShell className="max-w-3xl py-12">
      <h1 className="font-heading text-3xl font-bold tracking-tight">Report illegal content</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Hosted FluxyChat stores share pages and room data. If you think a public URL is illegal, send a
        notice. We are not a very large online platform. This form is a hosting notice, not a court
        filing, and not legal advice.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        We need an explanation, the exact HTTPS URL, a contact, and a good-faith statement. If the path
        is <code>/share/</code> plus a 48-hex token, we revoke that token. We do not mint a replacement.
        The operator may still have the room.
      </p>
      <DsaReportForm />
      <p className="mt-8 text-sm">
        Trusted flagger / DSA contact:{" "}
        <a className="underline underline-offset-2" href="mailto:support@fluxychat.com">
          support@fluxychat.com
        </a>
        {" · "}
        <Link className="underline underline-offset-2" href={HOSTED_PATHS.trust}>
          Trust
        </Link>
        {" · "}
        <a className="underline underline-offset-2" href="/.well-known/security.txt">
          security.txt
        </a>
      </p>
    </MarketingShell>
  );
}
