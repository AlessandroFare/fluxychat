"use client"

import { SlideLayout } from "./slide-layout"

export function SlideProblem() {
  return (
    <SlideLayout slideNumber={2} totalSlides={10}>
      <div className="space-y-12">
        {/* Headline */}
        <h2 className="text-5xl font-bold tracking-tight text-foreground text-balance">
          REST is trivial on serverless.{" "}
          <span className="text-primary">WebSockets aren&apos;t.</span>
        </h2>

        {/* Bullets */}
        <ul className="space-y-4 text-xl text-muted-foreground">
          <li className="flex items-start gap-4">
            <span className="text-primary font-bold">→</span>
            <span>Need a second vendor just for realtime</span>
          </li>
          <li className="flex items-start gap-4">
            <span className="text-primary font-bold">→</span>
            <span>A whole new ops stack to learn and maintain</span>
          </li>
          <li className="flex items-start gap-4">
            <span className="text-primary font-bold">→</span>
            <span>Vercel doesn&apos;t host your sockets</span>
          </li>
        </ul>

        {/* Diagram */}
        <div className="mt-12 flex items-center justify-center gap-4">
          <div className="px-6 py-4 rounded-lg bg-secondary text-foreground font-medium">
            Your Next.js App
            <span className="block text-xs text-muted-foreground mt-1">
              on Vercel
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>→</span>
            <span className="text-3xl">❓</span>
            <span>→</span>
          </div>
          <div className="px-6 py-4 rounded-lg border-2 border-dashed border-border text-muted-foreground font-medium">
            Pusher / Ably / etc.
            <span className="block text-xs mt-1">another vendor</span>
          </div>
        </div>
      </div>
    </SlideLayout>
  )
}
