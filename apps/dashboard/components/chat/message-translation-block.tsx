"use client";

import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MessageTranslationEntry {
  translatedText: string;
  targetLang: string;
  sourceLang?: string | null;
  cached?: boolean;
}

interface MessageTranslationBlockProps {
  originalText: string;
  translation: MessageTranslationEntry;
  showOriginal: boolean;
  onToggle: () => void;
  isSelf?: boolean;
  className?: string;
}

/**
 * Toggle between original and translated message text (Stream-style UX).
 */
export function MessageTranslationBlock({
  originalText,
  translation,
  showOriginal,
  onToggle,
  isSelf = false,
  className,
}: MessageTranslationBlockProps) {
  const displayText = showOriginal ? originalText : translation.translatedText;
  const toggleLabel = showOriginal
    ? `Show translation (${translation.targetLang})`
    : "Show original";

  return (
    <div className={cn("mt-1", className)}>
      <p
        className={cn(
          "whitespace-pre-wrap break-words text-sm",
          !showOriginal && "italic",
          isSelf ? "text-white/90" : "text-foreground",
        )}
      >
        {displayText}
      </p>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
          isSelf
            ? "border-white/30 text-white/80 hover:bg-white/10"
            : "border-border text-muted-foreground hover:bg-muted/50",
        )}
        aria-pressed={showOriginal}
      >
        <Languages className="h-3 w-3" aria-hidden />
        {toggleLabel}
      </button>
    </div>
  );
}
