"use client"

import { FluxychatIcon } from "@/components/fluxychat-logo"
import { SlideLayout } from "./slide-layout"

export function SlideCTA() {
  return (
    <SlideLayout showLogo={false}>
      <div className="flex flex-col items-center justify-center text-center gap-8">
        {/* Logo */}
        <FluxychatIcon size={80} />

        {/* Headline */}
        <h2 className="text-5xl font-bold tracking-tight text-foreground">
          Try it today
        </h2>

        {/* Links grid */}
        <div className="grid grid-cols-2 gap-6 mt-4 w-full max-w-lg">
          <a
            href="https://fluxychat.vercel.app/landing"
            className="px-6 py-4 rounded-xl bg-primary text-primary-foreground font-medium text-lg hover:bg-primary/90 transition-colors"
          >
            Landing Page
            <span className="block text-sm opacity-80 font-normal mt-1">
              fluxychat.vercel.app
            </span>
          </a>
          <a
            href="https://fluxychat.vercel.app/why"
            className="px-6 py-4 rounded-xl bg-secondary text-foreground font-medium text-lg hover:bg-secondary/80 transition-colors"
          >
            Why Fluxychat?
            <span className="block text-sm text-muted-foreground font-normal mt-1">
              /why
            </span>
          </a>
          <a
            href="https://github.com/AlessandroFare/fluxychat"
            className="px-6 py-4 rounded-xl bg-secondary text-foreground font-medium text-lg hover:bg-secondary/80 transition-colors"
          >
            GitHub
            <span className="block text-sm text-muted-foreground font-normal mt-1">
              MIT licensed
            </span>
          </a>
          <a
            href="https://www.npmjs.com/package/@fluxy-chat/sdk"
            className="px-6 py-4 rounded-xl bg-secondary text-foreground font-medium text-lg hover:bg-secondary/80 transition-colors"
          >
            npm
            <span className="block text-sm text-muted-foreground font-normal mt-1">
              @fluxy-chat/sdk
            </span>
          </a>
        </div>

        {/* Contact */}
        <div className="mt-8 space-y-4">
          <p className="text-muted-foreground">
            Questions? Reach out at{" "}
            <a
              href="mailto:fluxychat@outlook.com"
              className="text-primary hover:underline"
            >
              fluxychat@outlook.com
            </a>
          </p>

          {/* QR placeholder */}
          <div className="mx-auto w-32 h-32 rounded-xl border-2 border-dashed border-border bg-secondary/50 flex items-center justify-center">
            <span className="text-xs text-muted-foreground text-center">
              QR code for
              <br />
              landing page
            </span>
          </div>
        </div>

        {/* Slide number */}
        <span className="absolute bottom-6 right-8 text-sm text-muted-foreground tabular-nums">
          10 / 10
        </span>
      </div>
    </SlideLayout>
  )
}
