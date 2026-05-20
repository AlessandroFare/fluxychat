"use client"

import { FluxychatIcon } from "@/components/fluxychat-logo"

interface SlideLayoutProps {
  children: React.ReactNode
  slideNumber?: number
  totalSlides?: number
  showLogo?: boolean
}

export function SlideLayout({
  children,
  slideNumber,
  totalSlides,
  showLogo = true,
}: SlideLayoutProps) {
  return (
    <div className="relative w-full h-full min-h-screen flex items-center justify-center bg-background px-16 py-12">
      {/* Slide content */}
      <div className="w-full max-w-6xl">{children}</div>

      {/* Footer */}
      <div className="absolute bottom-6 left-8 right-8 flex items-center justify-between text-muted-foreground text-sm">
        {showLogo && (
          <div className="flex items-center gap-2">
            <FluxychatIcon size={20} />
            <span className="font-medium text-foreground/70">fluxychat</span>
          </div>
        )}
        {slideNumber && totalSlides && (
          <span className="tabular-nums">
            {slideNumber} / {totalSlides}
          </span>
        )}
      </div>
    </div>
  )
}
