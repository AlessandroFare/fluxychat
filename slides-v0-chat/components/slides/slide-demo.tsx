"use client"

import { SlideLayout } from "./slide-layout"

export function SlideDemo() {
  return (
    <SlideLayout slideNumber={8} totalSlides={10}>
      <div className="space-y-10">
        {/* Headline */}
        <h2 className="text-5xl font-bold tracking-tight text-foreground">
          Live demo flow
        </h2>

        {/* Steps */}
        <div className="grid grid-cols-5 gap-4 mt-8">
          {[
            { step: 1, title: "Sign up", desc: "Create account" },
            { step: 2, title: "Quickstart", desc: "Project + member JWT" },
            { step: 3, title: "Create room", desc: "Via console or SDK" },
            { step: 4, title: "Send message", desc: "Real-time delivery" },
            { step: 5, title: "Add agent", desc: "(Optional) AI bot" },
          ].map((item) => (
            <div key={item.step} className="flex flex-col items-center">
              {/* Step number */}
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mb-4">
                {item.step}
              </div>
              
              {/* Title */}
              <h3 className="text-lg font-bold text-foreground mb-1">
                {item.title}
              </h3>
              <p className="text-sm text-muted-foreground text-center">
                {item.desc}
              </p>

              {/* Screenshot placeholder */}
              <div className="mt-4 w-full aspect-[4/3] rounded-lg border-2 border-dashed border-border bg-secondary/50 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">
                  screenshot
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Arrow connectors */}
        <div className="flex items-center justify-center gap-2 -mt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center">
              <div className="w-32" />
              <span className="text-muted-foreground text-2xl">→</span>
            </div>
          ))}
        </div>
      </div>
    </SlideLayout>
  )
}
