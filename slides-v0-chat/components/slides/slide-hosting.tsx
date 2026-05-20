"use client"

import { SlideLayout } from "./slide-layout"

export function SlideHosting() {
  return (
    <SlideLayout slideNumber={7} totalSlides={10}>
      <div className="space-y-10">
        {/* Headline */}
        <h2 className="text-5xl font-bold tracking-tight text-foreground">
          Hosted <span className="text-muted-foreground font-normal">vs</span>{" "}
          <span className="text-primary">self-host</span>
        </h2>

        {/* Split comparison */}
        <div className="grid grid-cols-2 gap-8 mt-8">
          {/* Hosted */}
          <div className="p-8 rounded-xl border-2 border-border bg-card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <span className="text-xl">☁️</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground">Hosted Cloud</h3>
            </div>
            <ul className="space-y-3 text-lg text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-primary">✓</span>
                <span>Sign up and get keys in minutes</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary">✓</span>
                <span>We manage Workers + D1</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary">✓</span>
                <span>Automatic updates</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary">✓</span>
                <span>Hosted open beta (see site for limits)</span>
              </li>
            </ul>
          </div>

          {/* Self-host */}
          <div className="p-8 rounded-xl border-2 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <span className="text-xl">🔧</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground">Self-Host</h3>
            </div>
            <ul className="space-y-3 text-lg text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="text-primary">✓</span>
                <span>Clone the MIT repo</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary">✓</span>
                <span>Deploy to your CF account</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary">✓</span>
                <span>Full control over infra</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-primary">✓</span>
                <span>Modify anything you want</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Same codebase callout */}
        <div className="text-center">
          <span className="inline-block px-6 py-3 rounded-full bg-secondary text-lg font-medium text-foreground">
            Same codebase. Same features. You choose where it runs.
          </span>
        </div>
      </div>
    </SlideLayout>
  )
}
