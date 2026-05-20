"use client"

import { SlideLayout } from "./slide-layout"

export function SlideConsole() {
  return (
    <SlideLayout slideNumber={6} totalSlides={10}>
      <div className="space-y-10">
        {/* Headline */}
        <h2 className="text-5xl font-bold tracking-tight text-foreground">
          Ship faster with the{" "}
          <span className="text-primary">console</span>
        </h2>

        {/* Content grid */}
        <div className="grid grid-cols-2 gap-12 mt-8">
          {/* Left: bullets */}
          <div className="space-y-6">
            <ul className="space-y-4 text-xl">
              <li className="flex items-start gap-4 text-foreground">
                <span className="text-primary font-bold">01</span>
                <span>Onboarding wizard → ready in 2 minutes</span>
              </li>
              <li className="flex items-start gap-4 text-foreground">
                <span className="text-primary font-bold">02</span>
                <span>Room management + live inspector</span>
              </li>
              <li className="flex items-start gap-4 text-foreground">
                <span className="text-primary font-bold">03</span>
                <span>AI agents config (coming soon)</span>
              </li>
              <li className="flex items-start gap-4 text-foreground">
                <span className="text-primary font-bold">04</span>
                <span>Webhooks for events</span>
              </li>
              <li className="flex items-start gap-4 text-foreground">
                <span className="text-primary font-bold">05</span>
                <span>GDPR export + deletion</span>
              </li>
            </ul>
          </div>

          {/* Right: wireframe mock */}
          <div className="rounded-xl border-2 border-border bg-card p-6">
            {/* Fake topbar */}
            <div className="flex items-center gap-3 pb-4 border-b border-border">
              <div className="w-3 h-3 rounded-full bg-primary/40" />
              <div className="w-3 h-3 rounded-full bg-border" />
              <div className="w-3 h-3 rounded-full bg-border" />
              <div className="flex-1" />
              <div className="w-20 h-4 rounded bg-secondary" />
            </div>

            {/* Fake sidebar + content */}
            <div className="flex mt-4 gap-4">
              {/* Sidebar */}
              <div className="w-32 space-y-2">
                <div className="h-8 rounded bg-primary/20" />
                <div className="h-8 rounded bg-secondary" />
                <div className="h-8 rounded bg-secondary" />
                <div className="h-8 rounded bg-secondary" />
              </div>

              {/* Content */}
              <div className="flex-1 space-y-3">
                <div className="h-6 w-48 rounded bg-secondary" />
                <div className="h-24 rounded bg-secondary/50" />
                <div className="h-12 rounded bg-secondary/50" />
              </div>
            </div>

            {/* Label */}
            <div className="mt-4 text-center text-xs text-muted-foreground">
              Operator Console UI
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  )
}
