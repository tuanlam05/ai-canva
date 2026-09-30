import { useState } from "react";
import type { BoxType } from "../types.js";
import { BOX_TYPES } from "../types.js";
import { BOX_USAGE, STEP_STYLE } from "../lib/nodeView.js";
import { BoxIcon, CloseIcon } from "./ui/icons.js";

/**
 * Canvas help card ("How to use") — bottom-left. Closed by default: it shows
 * as a small "?" button and opens the walkthrough of the research flow.
 * Note: the E2E suite locates this card by finding a `rounded-xl` div whose
 * text includes "How to use" — keep both markers when restyling.
 */

/** The walkthrough, in pipeline order (wording from the team's script). */
const STEPS: { type: BoxType; label: string }[] = [
  { type: "text", label: "Research inputs" },
  { type: "insight", label: BOX_TYPES.insight.label },
  { type: "journey", label: BOX_TYPES.journey.label },
  { type: "safety", label: BOX_TYPES.safety.label },
  { type: "coach", label: BOX_TYPES.coach.label },
  { type: "summary", label: BOX_TYPES.summary.label },
];

export default function Toolbar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="help-anchor absolute bottom-4 left-4 z-10">
      {open ? (
        <div className="anim-pop from-bottom-left rounded-xl bg-surface border border-line [box-shadow:var(--shadow-float)] p-4 w-[320px] max-h-[calc(100vh-140px)] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="m-0 text-[14px] font-semibold text-ink">How to use</h2>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-ink-icon hover:text-ink hover:bg-surface-sunken transition"
              title="Hide help"
              aria-label="Hide help"
            >
              <CloseIcon />
            </button>
          </div>

          <ol className="m-0 p-0 list-none flex flex-col gap-3">
            {STEPS.map((step) => (
              <li key={step.type} className="flex gap-2.5">
                <span
                  className="node-tile !w-7 !h-7 !rounded-[8px] mt-0.5"
                  style={{ "--tile-color": STEP_STYLE[step.type]?.color ?? "var(--ink)" } as React.CSSProperties}
                  aria-hidden
                >
                  <BoxIcon type={step.type} size={14} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink">{step.label}</span>
                  <span className="block text-[12.5px] leading-[1.45] text-ink-3">
                    {step.type === "text"
                      ? "Start here with your research material: paste interview notes into Text Context or upload a TXT, PDF or Word document. P1–P4 are test transcripts for this demo."
                      : BOX_USAGE[step.type]}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-3.5 pt-3 border-t border-line-divider flex flex-col gap-1.5 text-[12px] leading-[1.45] text-ink-muted">
            <p className="m-0">
              Click <span className="font-semibold text-ink">Run</span> on {BOX_TYPES.insight.label}, then on each next step.
              Drag between the dots on box edges to connect boxes.
            </p>
            <p className="m-0">
              Hold <span className="font-mono text-[11px] text-ink-2">Ctrl</span> /{" "}
              <span className="font-mono text-[11px] text-ink-2">⌘</span> while dragging a box to take it out of its group.
            </p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-surface border border-line [box-shadow:var(--shadow-float)] h-10 pl-3 pr-3.5 flex items-center gap-2 text-[13px] font-medium text-ink-3 hover:text-ink transition-colors"
          title="Show help"
        >
          <span className="w-5 h-5 rounded-full bg-ink text-on-ink grid place-items-center font-mono text-[11px] font-semibold">
            ?
          </span>
          How to use
        </button>
      )}
    </div>
  );
}
