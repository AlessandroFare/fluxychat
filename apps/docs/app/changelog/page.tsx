import type { Metadata } from "next";
import Link from "next/link";
import { loadChangelogReleases } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Release notes for FluxyChat SDK packages, sourced from repository CHANGELOG files.",
};

export default function ChangelogPage() {
  const releases = loadChangelogReleases();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <Link href="/docs" className="text-sm text-fd-muted-foreground hover:underline">
          ← Documentation
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Changelog</h1>
        <p className="mt-2 text-sm text-fd-muted-foreground">
          Public release notes from package CHANGELOG files in the monorepo. Tags and semver follow each package
          independently.
        </p>
      </div>

      {releases.length === 0 ? (
        <p className="text-sm text-fd-muted-foreground">No release notes found.</p>
      ) : (
        <div className="space-y-10">
          {releases.map((release) => (
            <article
              key={`${release.packageName}-${release.version}`}
              className="rounded-xl border border-fd-border bg-fd-card p-6"
            >
              <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-xl font-semibold">{release.version}</h2>
                <span className="font-mono text-xs text-fd-muted-foreground">{release.packageName}</span>
                {release.date ? (
                  <time className="text-xs text-fd-muted-foreground" dateTime={release.date}>
                    {release.date}
                  </time>
                ) : null}
              </header>

              <div className="mt-4 space-y-4">
                {release.sections.map((section) => (
                  <section key={section.heading}>
                    <h3 className="text-sm font-medium">{section.heading}</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fd-muted-foreground">
                      {section.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
