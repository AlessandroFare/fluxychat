import { LANDING_BADGES, STACK_LOGOS } from "./landing-shared";

export function LandingLogoStrip() {
  return (
    <section className="border-b border-[var(--mkt-border)] py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="mb-2 text-center text-xs font-semibold uppercase text-[var(--mkt-text-muted)]">
          Works with stacks you already use
        </p>
        <p className="mb-8 text-pretty text-center text-sm text-[var(--mkt-text-muted)]">
          One SDK across common frontends and runtimes. Fork the repo when you want full control.
        </p>
        <div
          className="landing-logo-marquee overflow-hidden py-2"
          aria-label="Frameworks and runtimes compatible with Fluxychat"
        >
          <div className="landing-logo-marquee__track flex w-max gap-3 sm:gap-4">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 gap-3 sm:gap-4">
                {STACK_LOGOS.map((name) => (
                  <span
                    key={`${copy}-${name}`}
                    className="inline-flex max-w-[10rem] items-center truncate rounded-full border border-[var(--mkt-border)] bg-[var(--mkt-surface)] px-4 py-2 text-sm font-semibold text-[var(--mkt-text)] sm:max-w-none"
                  >
                    {name}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 text-center sm:flex-row sm:gap-4">
          <p className="text-xs font-semibold uppercase text-[var(--mkt-text-muted)]">
            Featured on
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {LANDING_BADGES.map((badge) => (
              <a
                key={badge.id}
                href={badge.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <img
                  src={badge.imgSrc}
                  alt={badge.alt}
                  width={badge.width}
                  height={badge.height}
                  loading="lazy"
                  className="h-9 w-auto"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
