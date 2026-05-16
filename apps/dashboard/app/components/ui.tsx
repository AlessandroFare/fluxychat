"use client";

import React from "react";
import { cn } from "@/lib/utils";

type BannerVariant = "info" | "success" | "error";

const bannerVariantClass: Record<BannerVariant, string> = {
  info: "border-border bg-muted/60 text-foreground",
  success: "border-emerald-200/80 bg-emerald-50 text-emerald-950",
  error: "border-red-200/80 bg-red-50 text-red-950",
};

export function Banner({
  variant,
  children,
}: {
  variant: BannerVariant;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mb-3 rounded-xl border px-3 py-2.5 text-sm leading-relaxed shadow-sm",
        bannerVariantClass[variant],
      )}
    >
      {children}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "mb-6 rounded-2xl border border-black/[0.06] bg-white/90 p-5 shadow-[var(--shadow-subtle-2)] backdrop-blur-sm",
        "sm:p-6",
      )}
    >
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

type InputSize = "sm" | "md" | "lg";

const inputSizeClasses: Record<InputSize, string> = {
  sm: "h-7 px-2 text-xs",
  md: "h-8 px-2.5 text-sm",
  lg: "h-10 px-3 text-base",
};

export function Input({
  size = "md",
  className,
  style,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: InputSize;
  className?: string;
}) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-md border border-border bg-background text-foreground",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        inputSizeClasses[size],
        className,
      )}
      style={style}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    />
  );
}

type ButtonVariant = "primary" | "neutral" | "ghost" | "outline" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white border-transparent hover:opacity-90",
  neutral: "border-slate-800/15 bg-slate-900 text-white hover:bg-slate-800",
  ghost: "border-transparent bg-transparent text-foreground hover:bg-muted/80",
  outline: "border-border bg-background text-foreground hover:bg-muted/60",
  destructive: "bg-red-600 text-white border-red-600 hover:opacity-90",
};

const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs gap-1",
  md: "h-8 px-3 text-sm gap-1.5",
  lg: "h-10 px-4 text-base gap-2",
};

export function Button({
  variant = "neutral",
  size = "md",
  disabled,
  children,
  className,
  style,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-md border font-medium",
        "whitespace-nowrap transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        buttonVariantClasses[variant],
        buttonSizeClasses[size],
        className,
      )}
      style={style}
    >
      {children}
    </button>
  );
}

export { EmptyState } from "../../components/ui/EmptyState";
export { Panel } from "../../components/ui/Panel";
export { SkeletonCard } from "../../components/ui/SkeletonCard";
