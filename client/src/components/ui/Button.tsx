import type { ButtonHTMLAttributes } from "react";

/**
 * Shared button — the single source of truth for control styling in the app
 * chrome (header, sidebar, canvas tools).
 *
 * Research-canvas styling:
 *  - `primary` is ink (near-black; near-white in dark mode) — no brand
 *    colour, never full-width;
 *  - everything else is white / neutral grey with the control border;
 *  - 8px radius, 13px/500 labels, visible keyboard focus ring.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "xs" | "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-on-ink border border-ink " +
    "hover:bg-ink-hover hover:border-ink-hover",
  secondary:
    "bg-surface text-ink border border-line-control " +
    "hover:bg-surface-hover",
  ghost:
    "bg-transparent text-ink-3 border border-transparent " +
    "hover:bg-surface-sunken hover:text-ink",
  danger:
    "bg-surface text-[color:var(--red-text)] border border-[color:var(--red-border)] " +
    "hover:bg-[color:var(--red-bg)]",
};

/** Pressed / toggled state (e.g. an open panel or active view). */
const ACTIVE: Record<ButtonVariant, string> = {
  primary: "bg-ink-hover border-ink-hover text-on-ink hover:bg-ink-hover",
  secondary:
    "bg-surface-muted border-line-control text-ink " +
    "hover:bg-surface-muted",
  ghost: "bg-surface-muted border-transparent text-ink hover:bg-surface-muted",
  danger: "bg-[color:var(--red-text)] border-[color:var(--red-text)] text-on-ink",
};

const SIZE: Record<ButtonSize, string> = {
  xs: "h-[30px] px-3 text-[12.5px] gap-1.5 rounded-lg",
  sm: "h-[34px] px-3.5 text-[13px] gap-[7px] rounded-lg",
  md: "h-9 px-4 text-sm gap-2 rounded-lg",
};

const BASE =
  "inline-flex items-center justify-center font-medium whitespace-nowrap " +
  "transition-colors duration-150 select-none cursor-pointer " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(22,24,29,.35)] focus-visible:ring-offset-1 " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders the pressed/toggled state (e.g. an open panel). */
  active?: boolean;
}

export function Button({
  variant = "secondary",
  size = "sm",
  active = false,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    BASE,
    SIZE[size],
    active ? ACTIVE[variant] : VARIANT[variant],
    className,
  ].join(" ");
  return <button type={type} className={classes} {...rest} />;
}