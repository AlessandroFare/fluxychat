"use client"

import { SlideLayout } from "./slide-layout"

export function SlideAudience() {
  return (
    <SlideLayout slideNumber={4} totalSlides={10}>
      <div className="space-y-10">
        {/* Headline */}
        <h2 className="text-5xl font-bold tracking-tight text-foreground">
          Who it&apos;s for
        </h2>

        {/* Two columns */}
        <div className="grid grid-cols-2 gap-8 mt-8">
          {/* For you if */}
          <div className="p-8 rounded-xl bg-primary/5 border border-primary/20">
            <h3 className="text-2xl font-bold text-primary mb-6">
              ✓ For you if…
            </h3>
            <ul className="space-y-4 text-lg text-foreground">
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold mt-1">•</span>
                <span>You&apos;re building edge-native apps on Cloudflare</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold mt-1">•</span>
                <span>You want MIT license + self-host option</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold mt-1">•</span>
                <span>You want to build your own chat UI</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary font-bold mt-1">•</span>
                <span>You care about owning your infra</span>
              </li>
            </ul>
          </div>

          {/* Not for you if */}
          <div className="p-8 rounded-xl bg-secondary">
            <h3 className="text-2xl font-bold text-muted-foreground mb-6">
              ✗ Not for you if…
            </h3>
            <ul className="space-y-4 text-lg text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="font-bold mt-1">•</span>
                <span>You need a drop-in TalkJS-style widget today</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-bold mt-1">•</span>
                <span>You need enterprise SLA on day one</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-bold mt-1">•</span>
                <span>You need pre-built moderation dashboards</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="font-bold mt-1">•</span>
                <span>You&apos;re allergic to beta software</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </SlideLayout>
  )
}
