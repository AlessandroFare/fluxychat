import Link from "next/link";
import { COMPARE_ROWS, COMPARE_LABS_NOTE } from "@/lib/compare-providers";
import { HOSTED_PATHS } from "@/lib/hosted-product";

/** Server-rendered compare table — keeps marketing bundle smaller (ENG-13). */
export function LandingCompareSection() {
  return (
    <section
      id="compare"
      className="scroll-mt-20 border-b border-[var(--mkt-border)] px-4 py-20 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-balance text-center font-heading text-3xl font-bold tracking-tight text-[var(--mkt-text)]">
          How we compare
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-center text-[var(--mkt-text-muted)]">
          Not a feature shootout: rough fit vs Stream, Ably, Pusher, and DIY DO repos.{" "}
          <Link href={HOSTED_PATHS.compare} className="text-brand underline underline-offset-2">
            Full compare
          </Link>
          {" · "}
          <Link href="/guides/pusher-alternative-saas" className="text-brand underline underline-offset-2">
            Leaving Pusher
          </Link>
          .
        </p>
        <p className="mx-auto mt-2 max-w-2xl text-pretty text-center text-sm text-[var(--mkt-text-muted)]">
          {COMPARE_LABS_NOTE}
        </p>
        <div className="mt-10 overflow-x-auto rounded-2xl border border-[var(--mkt-border)] bg-[var(--mkt-surface)]">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm leading-relaxed text-[var(--mkt-text)]">
            <thead>
              <tr className="border-b border-[var(--mkt-border)] bg-[var(--mkt-surface-2)]">
                <th className="px-4 py-[1.125rem] font-semibold text-[var(--mkt-text)]">Capability</th>
                <th className="px-4 py-[1.125rem] font-medium text-[var(--mkt-text-muted)]">
                  Typical stream APIs
                </th>
                <th className="px-4 py-[1.125rem] font-medium text-[var(--mkt-text-muted)]">
                  Typical Ably-style
                </th>
                <th className="px-4 py-[1.125rem] font-medium text-[var(--mkt-text-muted)]">
                  Typical Channels (Pusher-style)
                </th>
                <th className="px-4 py-[1.125rem] font-semibold text-[var(--mkt-brand)]">Fluxychat</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-[var(--mkt-border)] last:border-0">
                  <td className="px-4 py-[1.125rem] font-medium text-[var(--mkt-text)]">{row.label}</td>
                  <td className="px-4 py-[1.125rem] text-[var(--mkt-text-muted)]">{row.stream}</td>
                  <td className="px-4 py-[1.125rem] text-[var(--mkt-text-muted)]">{row.ably}</td>
                  <td className="px-4 py-[1.125rem] text-[var(--mkt-text-muted)]">{row.pusher}</td>
                  <td className="px-4 py-[1.125rem] font-medium text-[var(--mkt-text)]">{row.fluxy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

