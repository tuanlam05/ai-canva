import { useState } from "react";
import type { ItemApproval, Risk } from "../../types";
import { useBoardStore } from "../../store/boardStore";
import { AlertIcon, CaretIcon, CheckIcon, CloseIcon } from "../ui/icons";

interface SafetyReviewerOutputProps {
  content: string;
  boxId: string;
  /**
   * An earlier version (see VersionHistory): shows the decisions saved with
   * it and has no Approve / Dismiss buttons.
   */
  readOnly?: boolean;
  savedApprovals?: Record<string, ItemApproval>;
}

/**
 * Renders the safety review's structured JSON output as a review list: a
 * segmented progress bar, then every risk as an expandable card, then a row
 * per stage that was reviewed and found clear.
 *
 * Each card always shows the risk summary, an expand arrow and the Approve /
 * Dismiss buttons — even when collapsed. Decisions are reversible (a
 * dismissed risk can be approved again and vice versa), so Dismiss applies
 * straight away without a confirmation step. Every card starts closed, and
 * after a decision the card collapses; nothing opens on its own.
 *
 * Every risk is approved by default: a card with no recorded decision still
 * flows to UX Recommendations, it just doesn't count as reviewed. Approving
 * marks it as researcher-confirmed; dismissing withholds it.
 */

/** Severity chip — only shown when the model output carries a severity. */
const SEVERITY_STYLE: Record<string, { label: string; cls: string }> = {
  high: { label: "HIGH", cls: "bg-[color:var(--red-bg)] text-[color:var(--red-text)]" },
  medium: { label: "MEDIUM", cls: "bg-[color:var(--amber-bg)] text-[color:var(--amber-text)]" },
  med: { label: "MEDIUM", cls: "bg-[color:var(--amber-bg)] text-[color:var(--amber-text)]" },
  low: { label: "LOW", cls: "bg-[color:var(--low-bg)] text-[color:var(--low-text)]" },
};

export default function SafetyReviewerOutput({
  content,
  boxId,
  readOnly = false,
  savedApprovals,
}: SafetyReviewerOutputProps) {
  // Accordion (view state only); null = everything closed.
  const [openFlag, setOpenFlag] = useState<string | null>(null);

  const setApproval = useBoardStore((s) => s.setApproval);
  const liveApprovals = useBoardStore((s) => s.boxData[boxId]?.approvals);
  const approvals = readOnly ? savedApprovals : liveApprovals;

  let risks: Risk[] = [];
  let clearStages: string[] = [];
  let parseError = false;

  try {
    const parsed = JSON.parse(content);
    risks = Array.isArray(parsed.risks) ? parsed.risks : [];
    clearStages = Array.isArray(parsed.clear_stages) ? parsed.clear_stages : [];
  } catch {
    parseError = true;
  }

  if (parseError) {
    return (
      <div className="m-3 p-3 rounded-lg bg-[color:var(--amber-bg)] text-[color:var(--amber-text)] text-[13px]">
        <span className="flex items-center gap-1.5 font-semibold">
          <AlertIcon /> Could not parse structured output. Showing raw text below.
        </span>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-[11.5px] leading-5 text-ink-3">
          {content}
        </pre>
      </div>
    );
  }

  if (risks.length === 0 && clearStages.length === 0) {
    return (
      <div className="text-ink-muted text-[13px] py-8 text-center">
        No safety review produced.
      </div>
    );
  }

  // Counted from the risks array rather than the approvals map so decisions
  // left over from a previous run can never inflate the total.
  const reviewedCount = risks.filter((r) => approvals?.[r.id]).length;

  // Record a decision and collapse this card if it was open. The next risk
  // stays closed until the researcher opens it.
  const decide = (riskId: string, status: "approved" | "dismissed") => {
    setApproval(boxId, riskId, status);
    setOpenFlag((open) => (open === riskId ? null : open));
  };

  return (
    <div className="nowheel">
      {risks.length > 0 && (
        <div className="px-3.5 py-3 border-b border-line-divider flex flex-col gap-[9px]">
          <span className="text-[13px] font-semibold text-ink">
            {reviewedCount === risks.length
              ? `All ${risks.length} risk${risks.length === 1 ? "" : "s"} reviewed`
              : `${reviewedCount} of ${risks.length} reviewed`}
          </span>
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${risks.length}, minmax(0, 1fr))` }}
          >
            {risks.map((r) => {
              const d = approvals?.[r.id]?.status;
              return (
                <div
                  key={r.id}
                  className="h-1.5 rounded-[3px] transition-colors duration-200"
                  style={{
                    background:
                      d === "approved"
                        ? "var(--step-safety)"
                        : d === "dismissed"
                          ? "var(--dismissed)"
                          : "var(--divider-soft)",
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="p-2.5 flex flex-col gap-1.5">
        {risks.map((risk) => {
          const decision = approvals?.[risk.id]?.status;
          const isDismissed = decision === "dismissed";
          const isApproved = decision === "approved";
          const isOpen = openFlag === risk.id;
          const severity = SEVERITY_STYLE[String((risk as any).severity ?? "").toLowerCase()];

          return (
            <div key={risk.id} className={"acc-row" + (isOpen ? " is-open" : "")}>
              {/* Summary row — always visible, with the expand arrow. */}
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenFlag(isOpen ? null : risk.id)}
                className="acc-head nodrag !items-start"
                title={isOpen ? "Collapse" : "Expand for details"}
              >
                <span className="mt-[3px]">
                  <CaretIcon className={"caret" + (isOpen ? " is-open" : "")} />
                </span>
                {severity && (
                  <span
                    className={
                      "w-[58px] h-5 flex-none grid place-items-center rounded-[5px] font-mono text-[10.5px] font-semibold tracking-[.04em] " +
                      severity.cls
                    }
                  >
                    {severity.label}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div
                    className={
                      "text-[13.5px] font-semibold leading-[1.35] [text-wrap:pretty] " +
                      (isDismissed ? "text-ink-muted line-through decoration-[color:var(--dismissed)]" : "text-ink")
                    }
                  >
                    {risk.summary}
                  </div>
                  <div className="text-[12px] text-ink-muted mt-0.5">
                    {risk.category} · {risk.stage}
                  </div>
                </div>
                {isApproved && (
                  <span className="flex-none mt-0.5 font-mono text-[11px] font-semibold text-[color:var(--step-safety)]">
                    Approved
                  </span>
                )}
                {isDismissed && (
                  <span className="flex-none mt-0.5 font-mono text-[11px] font-semibold text-ink-faint">
                    Dismissed
                  </span>
                )}
              </button>

              {/* Details — only when expanded. */}
              {isOpen && (
                <div
                  className={
                    "pl-[35px] pr-3 pt-0.5 flex flex-col gap-2.5 anim-fade-up" +
                    (readOnly ? " pb-3" : "")
                  }
                >
                  <div className="flex flex-wrap gap-1.5">
                    <span className="chip chip-red !h-[22px] !px-2">{risk.category}</span>
                    {!decision && (
                      <span className="chip !h-[22px] !px-2 font-medium border border-[color:var(--red-border)] text-[color:var(--red-text)]">
                        Human review required
                      </span>
                    )}
                  </div>

                  <div className="flex items-center flex-wrap gap-2 text-[12.5px] text-ink-3">
                    Affected journey stage
                    <span className="chip chip-violet">{risk.stage}</span>
                  </div>

                  <div>
                    <div className="mono-label">Reason for flagging</div>
                    <p className="mt-1 mb-0 text-[13px] leading-[1.5] text-ink-2 [text-wrap:pretty]">
                      {risk.reason}
                    </p>
                  </div>

                  {/* Evidence trace: stage → theme → the original quote. */}
                  <div>
                    <div className="mono-label">Evidence trace</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="chip chip-neutral is-wrap">{risk.stage}</span>
                      <span className="text-ink-icon text-[12px]">→</span>
                      <span className="chip chip-neutral is-wrap">{risk.theme}</span>
                    </div>
                  </div>

                  {risk.evidence?.map((ev, i) => (
                    <div key={i} className="quote-box">
                      <span>&ldquo;{ev.quote}&rdquo;</span>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[12px] text-[color:var(--meta-text)]">— {ev.source}</span>
                        <span className="font-mono text-[10px] tracking-[.06em] text-ink-icon">
                          READ-ONLY
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions — visible on every card, collapsed or not. The
                  current decision is shown as the selected button; clicking
                  the other one changes it. */}
              {!readOnly && (
                <div className="nodrag flex gap-2 pl-[35px] pr-3 pt-2 pb-3">
                  <button
                    type="button"
                    onClick={() => decide(risk.id, "approved")}
                    aria-pressed={isApproved}
                    className={"btn flex-1 !h-8 " + (isApproved ? "btn-primary" : "btn-secondary")}
                  >
                    <CheckIcon />
                    {isApproved ? "Approved" : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(risk.id, "dismissed")}
                    aria-pressed={isDismissed}
                    className={"btn flex-1 !h-8 " + (isDismissed ? "btn-primary" : "btn-secondary")}
                  >
                    <CloseIcon />
                    {isDismissed ? "Dismissed" : "Dismiss"}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Stages the reviewer checked and found clear. */}
        {clearStages.map((stage) => (
          <div
            key={stage}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] border border-dashed border-line-soft"
          >
            <span className="chip chip-violet">{stage}</span>
            <span className="text-[12.5px] text-ink-muted">
              No safety concerns identified for this stage
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
