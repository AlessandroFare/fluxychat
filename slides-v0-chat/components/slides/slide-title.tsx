"use client"

import { FluxychatIcon } from "@/components/fluxychat-logo"
import { SlideLayout } from "./slide-layout"

export function SlideTitle() {
  return (
    <SlideLayout showLogo={false}>
      <div className="flex flex-col items-center justify-center text-center gap-8">
        {/* Logo */}
        <FluxychatIcon size={100} />

        {/* Title */}
        <h1 className="text-7xl font-bold tracking-tight text-foreground">
          Fluxychat
        </h1>

        {/* Subtitle */}
        <p className="text-2xl text-muted-foreground font-medium">
          Realtime that feels like serverless
        </p>

        {/* Footer badges */}
        <div className="flex items-center gap-6 mt-8 text-sm text-muted-foreground">
          <span className="px-3 py-1.5 rounded-full bg-secondary">Open beta</span>
          <span className="px-3 py-1.5 rounded-full bg-secondary">MIT</span>
          <span className="px-3 py-1.5 rounded-full bg-secondary font-mono text-xs">
            fluxychat.vercel.app
          </span>
        </div>
      </div>
    </SlideLayout>
  )
}
