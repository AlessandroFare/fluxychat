"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink, ImageOff, Loader2 } from "lucide-react";

interface LinkPreviewProps {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  aiSummary?: string | null;
  className?: string;
}

export function LinkPreviewCard({ url, title, description, image, aiSummary, className }: LinkPreviewProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const hostname = extractHostname(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "mt-1.5 block overflow-hidden rounded-lg border border-border transition-colors hover:bg-muted/20",
        className,
      )}
    >
      {image && !imgError && (
        <div className="relative aspect-[2/1] w-full overflow-hidden bg-muted/30">
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
            </div>
          )}
          <img
            src={image}
            alt={title || ""}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={cn(
              "h-full w-full object-cover transition-opacity",
              imgLoaded ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          {hostname}
        </div>
        {title && (
          <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground line-clamp-2">
            {title}
          </p>
        )}
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}
        {aiSummary && aiSummary !== description ? (
          <p className="mt-1.5 text-xs leading-snug text-foreground/90 line-clamp-3">
            <span className="font-medium text-muted-foreground">AI · </span>
            {aiSummary}
          </p>
        ) : null}
      </div>
    </a>
  );
}

function extractHostname(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
