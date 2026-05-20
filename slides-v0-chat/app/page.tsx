"use client"

import { useState, useEffect, useCallback } from "react"
import {
  SlideTitle,
  SlideProblem,
  SlideSolution,
  SlideAudience,
  SlideSDK,
  SlideConsole,
  SlideHosting,
  SlideDemo,
  SlideTradeoffs,
  SlideCTA,
} from "@/components/slides"

const slides = [
  SlideTitle,
  SlideProblem,
  SlideSolution,
  SlideAudience,
  SlideSDK,
  SlideConsole,
  SlideHosting,
  SlideDemo,
  SlideTradeoffs,
  SlideCTA,
]

export default function SlideDeck() {
  const [currentSlide, setCurrentSlide] = useState(0)

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1))
  }, [])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0))
  }, [])

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(Math.max(0, Math.min(index, slides.length - 1)))
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "PageDown":
          e.preventDefault()
          nextSlide()
          break
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault()
          prevSlide()
          break
        case "Home":
          e.preventDefault()
          goToSlide(0)
          break
        case "End":
          e.preventDefault()
          goToSlide(slides.length - 1)
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [nextSlide, prevSlide, goToSlide])

  const CurrentSlideComponent = slides[currentSlide]

  return (
    <main className="w-screen h-screen overflow-hidden bg-background">
      {/* Slide content - 16:9 aspect ratio container */}
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-full h-full max-h-[100vw*9/16] aspect-[16/9]">
          <CurrentSlideComponent />
        </div>
      </div>

      {/* Navigation dots */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-card/80 backdrop-blur-sm rounded-full border border-border">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentSlide
                ? "bg-primary w-6"
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Click zones for navigation */}
      <button
        onClick={prevSlide}
        className="fixed left-0 top-0 w-1/4 h-full cursor-w-resize opacity-0"
        aria-label="Previous slide"
      />
      <button
        onClick={nextSlide}
        className="fixed right-0 top-0 w-1/4 h-full cursor-e-resize opacity-0"
        aria-label="Next slide"
      />

      {/* Keyboard hints (hidden on small screens) */}
      <div className="fixed bottom-4 right-4 text-xs text-muted-foreground/50 hidden md:block">
        ← → to navigate
      </div>
    </main>
  )
}
