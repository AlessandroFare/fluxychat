import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"

const messageVariants = cva(
  "group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse",
  {
    variants: {
      variant: {
        default: "",
        ghost: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function MessageGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-group"
      className={cn("flex min-w-0 flex-col gap-2", className)}
      {...props}
    />
  )
}

function Message({
  className,
  align = "start",
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  align?: "start" | "end"
  variant?: "default" | "ghost"
}) {
  return (
    <div
      data-slot="message"
      data-align={align}
      data-variant={variant}
      className={cn(messageVariants({ variant }), className)}
      {...props}
    />
  )
}

function MessageAvatar({
  className,
  status,
  ...props
}: React.ComponentProps<"div"> & {
  status?: "online" | "offline" | "away" | null
}) {
  return (
    <div className="relative shrink-0 self-end">
      <div
        data-slot="message-avatar"
        className={cn(
          "flex w-fit min-w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted group-has-data-[slot=message-footer]/message:-translate-y-8",
          className
        )}
        {...props}
      />
      {status ? (
        <span
          data-slot="message-avatar-status"
          data-status={status}
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background",
            status === "online" && "bg-[oklch(0.72_0.19_149)]",
            status === "away" && "bg-[oklch(0.75_0.18_70)]",
            status === "offline" && "bg-muted-foreground"
          )}
          aria-label={status}
        />
      ) : null}
    </div>
  )
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end",
        className
      )}
      {...props}
    />
  )
}

function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "flex max-w-full min-w-0 items-center gap-2 px-3 text-xs font-medium text-muted-foreground group-data-[variant=ghost]/message:px-0",
        className
      )}
      {...props}
    />
  )
}

function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-footer"
      className={cn(
        "flex max-w-full min-w-0 items-center gap-1.5 px-3 text-xs font-medium text-muted-foreground group-data-[variant=ghost]/message:px-0 group-data-[align=end]/message:justify-end",
        className
      )}
      {...props}
    />
  )
}

const timestampVariants = cva(
  "shrink-0 tabular-nums text-muted-foreground/80",
  {
    variants: {
      size: {
        sm: "text-[10px]",
        default: "text-xs",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function MessageTimestamp({
  className,
  size,
  timestamp,
  ...props
}: React.ComponentProps<"time"> & {
  size?: "sm" | "default"
  /** ISO timestamp string; if provided, the <time> element gets a dateTime attr. */
  timestamp?: string
}) {
  const display = props.children ?? (timestamp ? formatTime(timestamp) : null)
  return (
    <time
      data-slot="message-timestamp"
      dateTime={timestamp}
      className={cn(timestampVariants({ size }), className)}
      {...props}
    >
      {display}
    </time>
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  } catch {
    return iso
  }
}

const statusConfig: Record<string, { icon: string; label: string; className: string }> = {
  sending: { icon: "○", label: "Sending", className: "text-muted-foreground/60" },
  sent: { icon: "✓", label: "Sent", className: "text-muted-foreground/60" },
  delivered: { icon: "✓✓", label: "Delivered", className: "text-muted-foreground/80" },
  read: { icon: "✓✓", label: "Read", className: "text-primary" },
  failed: { icon: "!", label: "Failed", className: "text-destructive" },
}

function MessageStatus({
  status,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  status: "sending" | "sent" | "delivered" | "read" | "failed"
}) {
  const cfg = statusConfig[status] ?? statusConfig.sent
  return (
    <span
      data-slot="message-status"
      data-status={status}
      role="status"
      aria-label={cfg.label}
      className={cn("shrink-0 text-xs", cfg.className, className)}
      {...props}
    >
      <span aria-hidden>{cfg.icon}</span>
      <span className="sr-only">{cfg.label}</span>
    </span>
  )
}

const messageActionsVariants = cva(
  "flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-slate-900 shadow-md data-[align=end]:flex-row-reverse",
  {
    variants: {
      align: {
        start: "",
        end: "",
      },
    },
    defaultVariants: {
      align: "start",
    },
  }
)

function MessageActions({
  className,
  align = "start",
  ...props
}: React.ComponentProps<"div"> & {
  align?: "start" | "end"
}) {
  return (
    <div
      data-slot="message-actions"
      data-align={align}
      className={cn(messageActionsVariants({ align }), className)}
      {...props}
    />
  )
}

function MessageHoverToolbar({
  align = "start",
  side = "above",
  className,
  children,
}: {
  align?: "start" | "end"
  side?: "above" | "below"
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      data-slot="message-hover-toolbar"
      className={cn(
        "pointer-events-none absolute z-30 invisible group-hover/message:pointer-events-auto group-hover/message:visible",
        side === "below" ? "top-full mt-1" : "bottom-full mb-1",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      <MessageActions align={align}>{children}</MessageActions>
    </div>
  )
}

const messageToolbarButtonClass =
  "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900"

const messageToolbarIconButtonClass =
  "rounded-full p-1 text-slate-600 hover:bg-slate-100"

function MessageAction({
  className,
  label,
  ...props
}: React.ComponentProps<"button"> & {
  label: string
}) {
  return (
    <button
      type="button"
      data-slot="message-action"
      aria-label={label}
      title={label}
      className={cn(messageToolbarIconButtonClass, className)}
      {...props}
    />
  )
}

function MessageReactions({
  className,
  reactions,
  onReact,
  ...props
}: React.ComponentProps<"div"> & {
  reactions?: Record<string, number>
  onReact?: (emoji: string) => void
}) {
  const entries = reactions ? Object.entries(reactions) : []
  if (entries.length === 0) return null

  return (
    <div
      data-slot="message-reactions"
      className={cn("flex flex-wrap items-center gap-1", className)}
      {...props}
    >
      {entries.map(([emoji, count]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact?.(emoji)}
          className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <span aria-hidden>{emoji}</span>
          {count > 1 ? <span className="tabular-nums">{count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export {
  MessageGroup,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
  MessageTimestamp,
  MessageStatus,
  MessageActions,
  MessageHoverToolbar,
  MessageAction,
  MessageReactions,
  messageToolbarButtonClass,
  messageToolbarIconButtonClass,
}
