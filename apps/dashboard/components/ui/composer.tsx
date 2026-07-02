"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { PaperclipIcon, SmileIcon, MicIcon, SendIcon, Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const composerVariants = cva(
  "flex flex-col gap-2 rounded-xl border border-border bg-background p-2 focus-within:ring-2 focus-within:ring-ring/30",
  {
    variants: {
      variant: {
        default: "",
        compact: "gap-1 p-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Composer({
  className,
  variant = "default",
  onSubmit,
  children,
  ...props
}: React.ComponentProps<"form"> &
  VariantProps<typeof composerVariants> & {
    onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void
  }) {
  return (
    <form
      data-slot="composer"
      data-variant={variant}
      className={cn(composerVariants({ variant }), className)}
      onSubmit={onSubmit}
      {...props}
    >
      {children}
    </form>
  )
}

const ComposerTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea"> & {
    maxHeight?: number
  }
>(function ComposerTextarea(
  { className, maxHeight = 200, onInput, ...props },
  ref
) {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null)
  const setRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node
    },
    [ref]
  )

  const resize = React.useCallback(() => {
    const el = innerRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [maxHeight])

  return (
    <textarea
      ref={setRef}
      data-slot="composer-textarea"
      className={cn(
        "min-h-[40px] w-full resize-none border-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onInput={(e) => {
        resize()
        onInput?.(e)
      }}
      rows={1}
      {...props}
    />
  )
})

function ComposerToolbar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="composer-toolbar"
      className={cn(
        "flex items-center justify-between gap-1 px-1",
        className
      )}
      {...props}
    />
  )
}

function ComposerToolbarLeft({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="composer-toolbar-left"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  )
}

function ComposerToolbarRight({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="composer-toolbar-right"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  )
}

const ComposerIconButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    label: string
  }
>(function ComposerIconButton(
  { className, label, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      data-slot="composer-icon-button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...props}
    />
  )
})

function ComposerAttachmentPicker({
  className,
  onFilesSelected,
  accept,
  multiple = true,
  disabled,
  ...props
}: React.ComponentProps<"button"> & {
  onFilesSelected?: (files: FileList) => void
  accept?: string
  multiple?: boolean
  disabled?: boolean
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  return (
    <>
      <ComposerIconButton
        ref={undefined}
        label="Attach files"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={className}
        {...props}
      >
        <PaperclipIcon className="size-4" />
      </ComposerIconButton>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFilesSelected?.(e.target.files)
          e.target.value = ""
        }}
      />
    </>
  )
}

function ComposerSubmitButton({
  className,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  loading?: boolean
}) {
  return (
    <Button
      type="submit"
      data-slot="composer-submit"
      data-loading={loading}
      disabled={disabled || loading}
      size="icon"
      className={cn("size-8 shrink-0", className)}
      {...props}
    >
      {loading ? (
        <Loader2Icon className="size-4 animate-spin" />
      ) : (
        children ?? <SendIcon className="size-4" />
      )}
      <span className="sr-only">{loading ? "Sending…" : "Send message"}</span>
    </Button>
  )
}

export {
  Composer,
  ComposerTextarea,
  ComposerToolbar,
  ComposerToolbarLeft,
  ComposerToolbarRight,
  ComposerIconButton,
  ComposerAttachmentPicker,
  ComposerSubmitButton,
}
