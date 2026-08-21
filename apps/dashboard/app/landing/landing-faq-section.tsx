import { LANDING_FAQ } from "@/lib/marketing-faq";

export function LandingFaqSection() {
  return (
    <section id="faq" className="scroll-mt-24 border-b border-[var(--mkt-border)] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-2 text-balance text-center font-heading text-2xl font-bold tracking-tight text-[var(--mkt-text)]">FAQs</h2>
        <p className="mb-8 text-pretty text-center text-sm text-[var(--mkt-text-muted)]">
          Questions we hear when teams compare hosted chat APIs and edge deployments.
        </p>
        <div className="space-y-3">
          {LANDING_FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-[var(--mkt-border)] bg-[var(--mkt-surface)] px-4 py-3"
            >
              <summary className="cursor-pointer list-none font-medium text-[var(--mkt-text)] [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  {item.q}
                  <span className="text-[var(--mkt-text-muted)] transition group-open:rotate-180">▾</span>
                </span>
              </summary>
              <p className="mt-3 border-t border-[var(--mkt-border)] pt-3 text-pretty text-sm leading-relaxed text-[var(--mkt-text-muted)]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
