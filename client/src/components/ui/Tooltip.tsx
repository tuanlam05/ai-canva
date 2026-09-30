import type { ReactNode } from "react";

/**
 * Small tooltip that appears ABOVE its trigger on hover or keyboard focus
 * (tap-to-focus on touch). Pure CSS (.tip / .tip-bubble in index.css), so it
 * works inside canvas nodes without portals.
 */
export function Tooltip({
  text,
  children,
  align = "start",
}: {
  text?: string;
  children: ReactNode;
  /** Horizontal anchor of the bubble relative to the trigger. */
  align?: "start" | "end";
}) {
  if (!text) return <>{children}</>;
  return (
    <span className="tip nodrag" tabIndex={0} aria-label={text}>
      {children}
      <span role="tooltip" className={"tip-bubble" + (align === "end" ? " is-end" : "")}>
        {text}
      </span>
    </span>
  );
}
