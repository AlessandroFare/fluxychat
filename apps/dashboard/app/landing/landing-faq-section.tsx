import { LANDING_FAQ } from "@/lib/marketing-faq";

export function LandingFaqSection() {
  return (
    <section id="faq" className="scroll-mt-24 border-b border-border bg-white px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-2 text-center font-heading text-2xl font-bold tracking-tight">FAQs</h2>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Questions we hear when teams compare hosted chat APIs and edge deployments.
        </p>
        <div className="space-y-3">
          {LANDING_FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-border bg-card px-4 py-3 shadow-sm open:shadow-md"
            >
              <summary className="cursor-pointer list-none font-medium text-foreground [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  {item.q}
                  <span className="text-muted-foreground transition group-open:rotate-180">▾</span>
                </span>
              </summary>
              <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
