"use client"

import { SlideLayout } from "./slide-layout"

export function SlideSolution() {
  return (
    <SlideLayout slideNumber={3} totalSlides={10}>
      <div className="space-y-10">
        {/* Headline */}
        <h2 className="text-5xl font-bold tracking-tight text-foreground">
          Chat on your{" "}
          <span className="text-primary">Cloudflare edge</span>
        </h2>

        {/* Architecture diagram */}
        <div className="flex items-center justify-center gap-6 mt-8">
          {/* Next.js App */}
          <div className="flex flex-col items-center gap-2">
            <div className="px-5 py-3 rounded-lg bg-foreground text-background font-medium text-sm">
              Next.js App
            </div>
            <span className="text-xs text-muted-foreground">your frontend</span>
          </div>

          <Arrow />

          {/* SDK */}
          <div className="flex flex-col items-center gap-2">
            <div className="px-5 py-3 rounded-lg bg-secondary text-foreground font-mono text-sm">
              @fluxy-chat/sdk
            </div>
            <span className="text-xs text-muted-foreground">npm package</span>
          </div>

          <Arrow />

          {/* Cloudflare section */}
          <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-4">
              {/* Worker */}
              <div className="flex flex-col items-center gap-2">
                <div className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm">
                  Worker
                </div>
                <span className="text-xs text-muted-foreground">API + WS</span>
              </div>

              <Arrow small />

              {/* DO + D1 */}
              <div className="flex flex-col gap-3">
                <div className="px-4 py-2 rounded-lg bg-primary/80 text-primary-foreground font-medium text-sm text-center">
                  Durable Object
                  <span className="block text-xs opacity-80">per room</span>
                </div>
                <div className="px-4 py-2 rounded-lg bg-primary/60 text-primary-foreground font-medium text-sm text-center">
                  D1
                  <span className="block text-xs opacity-80">messages</span>
                </div>
              </div>
            </div>
            {/* Cloudflare badge */}
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <CloudflareLogo />
              <span>Cloudflare</span>
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  )
}

function Arrow({ small = false }: { small?: boolean }) {
  return (
    <svg
      width={small ? 24 : 32}
      height={small ? 16 : 20}
      viewBox="0 0 32 20"
      fill="none"
      className="text-muted-foreground"
    >
      <path
        d="M0 10h28m0 0l-6-6m6 6l-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloudflareLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M16.5 17.5H7c-2.5 0-4.5-2-4.5-4.5S4.5 8.5 7 8.5h.5C8 6 10 4 12.5 4c2 0 3.7 1.2 4.4 3h.6c2.2 0 4 1.8 4 4s-1.8 4-4 4h-1"
        stroke="#F6821F"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
