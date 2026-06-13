import Link from "next/link";
import { COMPARE_ROWS } from "@/lib/compare-providers";
import { HOSTED_PATHS } from "@/lib/hosted-product";

/** Server-rendered compare table — keeps marketing bundle smaller (ENG-13). */
export function LandingCompareSection() {
  return (
    <section
      id="compare"
      className="scroll-mt-20 border-b border-border bg-white px-4 py-20 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-heading text-3xl font-bold tracking-tight">
          How we compare
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Not a feature shootout — rough fit vs Stream, Ably, Pusher, and DIY DO repos.{" "}
          <Link href={HOSTED_PATHS.compare} className="text-brand hover:underline">
            Full compare
          </Link>
          {" · "}
          <Link href="/guides/pusher-alternative-saas" className="text-brand hover:underline">
            Leaving Pusher
          </Link>
          .
        </p>
        <div className="mt-10 overflow-x-auto rounded-2xl border border-border shadow-sm">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm leading-relaxed">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-[1.125rem] font-semibold">Capability</th>
                <th className="px-4 py-[1.125rem] font-medium text-muted-foreground">
                  Typical stream APIs
                </th>
                <th className="px-4 py-[1.125rem] font-medium text-muted-foreground">
                  Typical Ably-style
                </th>
                <th className="px-4 py-[1.125rem] font-medium text-muted-foreground">
                  Typical Channels (Pusher-style)
                </th>
                <th className="px-4 py-[1.125rem] font-semibold text-primary">Fluxychat</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <td className="px-4 py-[1.125rem] font-medium">{row.label}</td>
                  <td className="px-4 py-[1.125rem] text-muted-foreground">{row.stream}</td>
                  <td className="px-4 py-[1.125rem] text-muted-foreground">{row.ably}</td>
                  <td className="px-4 py-[1.125rem] text-muted-foreground">{row.pusher}</td>
                  <td className="px-4 py-[1.125rem] font-medium text-foreground">{row.fluxy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
