import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

type BubbleVariant =
  | "default"
  | "secondary"
  | "muted"
  | "tinted"
  | "outline"
  | "ghost"
  | "destructive"
  | "sent"
  | "received"
  | "typing"

const BubbleVariantContext = React.createContext<BubbleVariant>("default")

function BubbleGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-group"
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props}
    />
  )
}

const bubbleVariants = cva(
  "group/bubble relative flex w-fit max-w-[75%] min-w-[48px] min-h-[36px] min-w-0 flex-col gap-1 group-data-[align=end]/message:self-end data-[align=end]:self-end data-[variant=ghost]:max-w-full",
  {
    variants: {
      variant: {
        default: "",
        secondary: "",
        muted: "",
        tinted: "",
        outline: "",
        ghost: "",
        destructive: "",
        sent: "",
        received: "",
        typing: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const bubbleContentVariants = cva(
  "w-fit max-w-full min-w-0 overflow-hidden rounded-2xl border border-transparent px-4 py-3 text-sm leading-relaxed wrap-break-word group-data-[align=end]/bubble:self-end [button]:text-left [button,a]:transition-colors [button,a]:outline-none [button,a]:focus-visible:border-ring [button,a]:focus-visible:ring-3 [button,a]:focus-visible:ring-ring/50",
  {
    variants: {
      variant: {
        default: "bg-[#FF6A1A] text-white [button,a]:hover:bg-[#FF6A1A]/80",
        secondary:
          "bg-secondary text-secondary-foreground [button,a]:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        muted:
          "bg-muted text-foreground [button,a]:hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_8%)]",
        tinted:
          "bg-[oklch(from_var(--primary)_0.93_0.04_h)] text-foreground dark:bg-[oklch(from_var(--primary)_0.32_0.06_h)] [button,a]:hover:bg-[oklch(from_var(--primary)_0.88_0.06_h)] dark:[button,a]:hover:bg-[oklch(from_var(--primary)_0.38_0.08_h)]",
        outline:
          "border-border bg-background text-foreground [button,a]:hover:bg-muted [button,a]:hover:text-foreground dark:[button,a]:hover:bg-input/30",
        ghost:
          "rounded-none border-none bg-transparent p-0 [button,a]:hover:bg-muted dark:[button,a]:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive dark:bg-destructive/20 [button,a]:hover:bg-destructive/20 dark:[button,a]:hover:bg-destructive/30",
        sent:
          "bg-[var(--fluxy-bubble-sent-bg)] text-[var(--fluxy-bubble-sent-text)] [button,a]:hover:bg-[color-mix(in_oklch,var(--fluxy-bubble-sent-bg)_90%,black)] rounded-2xl rounded-br-md",
        received:
          "bg-[var(--fluxy-bubble-received-bg)] text-[var(--fluxy-bubble-received-text)] border border-[var(--fluxy-bubble-received-border)] [button,a]:hover:bg-[color-mix(in_oklch,var(--fluxy-bubble-received-bg)_90%,black)] rounded-2xl rounded-bl-md",
        typing:
          "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Bubble({
  variant = "default",
  align = "start",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof bubbleVariants> & {
    align?: "start" | "end"
  }) {
  const resolvedVariant = (variant ?? "default") as BubbleVariant

  return (
    <BubbleVariantContext.Provider value={resolvedVariant}>
      <div
        data-slot="bubble"
        data-variant={resolvedVariant}
        data-align={align}
        className={cn(bubbleVariants({ variant: resolvedVariant }), className)}
        {...props}
      >
        {children}
      </div>
    </BubbleVariantContext.Provider>
  )
}

function BubbleContent({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  asChild?: boolean
}) {
  const variant = React.useContext(BubbleVariantContext)
  const Comp = asChild ? Slot.Root : "div"

  return (
    <Comp
      data-slot="bubble-content"
      className={cn(bubbleContentVariants({ variant }), className)}
      {...props}
    />
  )
}

function BubbleTitle({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-title"
      className={cn(
        "mb-0.5 text-xs font-semibold text-muted-foreground/90",
        className
      )}
      {...props}
    />
  )
}

function BubbleCaption({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-caption"
      className={cn(
        "mt-1 text-xs text-muted-foreground/80",
        className
      )}
      {...props}
    />
  )
}

function BubbleActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-actions"
      className={cn(
        "mt-1.5 flex items-center gap-1",
        className
      )}
      {...props}
    />
  )
}

const bubbleReactionsVariants = cva(
  "absolute z-10 flex h-6 w-fit shrink-0 items-center gap-1 rounded-full border border-[#e5e7eb] bg-white px-2 py-0.5 text-[13px] shadow-[0_1px_3px_rgba(0,0,0,0.1)]",
  {
    variants: {
      side: {
        top: "top-0 -translate-y-3/4",
        bottom: "bottom-[-10px]",
      },
      align: {
        start: "left-2",
        end: "right-2",
      },
    },
    defaultVariants: {
      side: "bottom",
      align: "end",
    },
  }
)

function BubbleReactions({
  side = "bottom",
  align = "end",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  align?: "start" | "end"
  side?: "top" | "bottom"
}) {
  return (
    <div
      data-slot="bubble-reactions"
      data-align={align}
      data-side={side}
      className={cn(bubbleReactionsVariants({ side, align }), className)}
      {...props}
    />
  )
}

/**
 * Animated typing dots for use inside a `<Bubble variant="typing">`.
 * Renders three bouncing dots with staggered animation delays.
 * Respects `prefers-reduced-motion`.
 */
function BubbleTypingDots({ className }: { className?: string }) {
  return (
    <span
      data-slot="bubble-typing-dots"
      className={cn("inline-flex items-center gap-1 py-0.5", className)}
      aria-label="Typing"
      role="status"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-2 animate-bounce rounded-full bg-current"
          style={{ animationDelay: `${i * 150}ms`, animationDuration: "1s" }}
        />
      ))}
    </span>
  )
}

export {
  BubbleGroup,
  Bubble,
  BubbleContent,
  BubbleTitle,
  BubbleCaption,
  BubbleActions,
  BubbleReactions,
  BubbleTypingDots,
}
