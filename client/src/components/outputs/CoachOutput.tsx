import { useState } from "react";
import type { Risk } from "../../types";
import { useBoardStore } from "../../store/boardStore";
import { AlertIcon, CaretIcon } from "../ui/icons";

interface CoachOutputProps {
  content: string;
  boxId: string;
  /**
   * An earlier version (see VersionHistory): every card, and no review state,
   * since the Safety Risk Review decisions belong to its current version.
   */
  readOnly?: boolean;
}

interface CoachGuidance {
  id: string;
  risk_id: string;
  stage: string;
  plain_summary: string;
  why_it_matters: string;
  next_steps: string[];
  researcher_confirmed: boolean;
}

interface ResearchNext {
  id: string;
  question: string;
  why: string;
  risk_ids: string[];
}

interface CoachOutputData {
  guidance: CoachGuidance[];
  research_next: ResearchNext[];
}

/**
 * UX Coach recommendations as an accordion of cards. Coach items carry no
 * decisions of their own: each card mirrors the Safety Reviewer decision on
 * the risk it responds to (dismissed risks are hidden, as before). Earlier
 * versions show every card without that review state.
 */
export default function CoachOutput({ content, boxId, readOnly = false }: CoachOutputProps) {
  const [expandedResearch, setExpandedResearch] = useState<string | null>(null);
  // Accordion (view state only); every card starts closed.
  const [openItem, setOpenItem] = useState<string | null>(null);

  const edges = useBoardStore((s) => s.edges);
  const boxData = useBoardStore((s) => s.boxData);

  const safetyBoxId = edges.find((edge) => edge.target === boxId)?.source;

  const safetyData = safetyBoxId ? boxData[safetyBoxId] : undefined;

  const approvals = safetyData?.approvals;

  let risks: Risk[] = [];

  try {
    const parsedSafety = JSON.parse(safetyData?.output ?? "{}");

    risks = Array.isArray(parsedSafety.risks) ? parsedSafety.risks : [];
  } catch {
    risks = [];
  }

  let guidance: CoachGuidance[] = [];
  let researchNext: ResearchNext[] = [];
  let parseError = false;

  try {
    const parsed: CoachOutputData = JSON.parse(content);

    guidance = Array.isArray(parsed.guidance) ? parsed.guidance : [];

    researchNext = Array.isArray(parsed.research_next)
      ? parsed.research_next
      : [];
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

  const visibleGuidance = readOnly
    ? guidance
    : guidance.filter((item) => {
        const risk = risks.find((r) => r.id === item.risk_id);

        if (!risk) return false;

        const decision = approvals?.[item.risk_id]?.status;

        return decision !== "dismissed";
      });

  const liveRisks = risks.filter(
    (risk) => approvals?.[risk.id]?.status !== "dismissed",
  );

  if (guidance.length === 0 && researchNext.length === 0) {
    return (
      <div className="text-ink-muted text-[13px] leading-[1.5] py-8 px-5 text-center">
        {readOnly
          ? "This version has no guidance."
          : liveRisks.length === 0
            ? "No safety risks were passed on, so there is nothing to advise on. Run Safety Risk Review first, or restore a dismissed risk."
            : "No guidance produced."}
      </div>
    );
  }

  return (
    <div className="nowheel p-2.5 flex flex-col gap-1.5 min-w-0">
      <div className="mx-0.5 mb-1 px-3 py-2 rounded-lg bg-surface-sunken text-[12.5px] leading-[1.5] text-ink-3">
        Advisory only. Nothing here changes the pipeline output.
      </div>

      {visibleGuidance.length === 0 && researchNext.length === 0 && (
        <div className="text-ink-muted text-[13px] py-6 text-center">
          All guidance has been dismissed in Safety Risk Review.
        </div>
      )}

      {visibleGuidance.map((item) => {
        const risk = risks.find((r) => r.id === item.risk_id);

        if (!risk && !readOnly) return null;

        const decision = approvals?.[item.risk_id]?.status;
        const isOpen = openItem === item.id;

        return (
          <div
            key={item.id}
            className={"acc-row" + (isOpen ? " is-open" : "")}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenItem(isOpen ? null : item.id)}
              className="acc-head nodrag !items-start"
            >
              <span className="mt-[3px]">
                <CaretIcon className={"caret" + (isOpen ? " is-open" : "")} />
              </span>
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                {!readOnly && risk && (
                  <span className="chip chip-red is-wrap self-start !text-[11px]">
                    Responds to · {risk.category}
                  </span>
                )}
                <span className="text-[13.5px] font-semibold leading-[1.4] text-ink [text-wrap:pretty] [overflow-wrap:anywhere]">
                  {item.plain_summary}
                </span>
              </div>
              {readOnly ? null : decision === "approved" ? (
                <span className="flex-none mt-0.5 font-mono text-[11px] font-semibold text-[color:var(--step-coach)]">
                  Approved
                </span>
              ) : (
                <span
                  className="flex-none mt-0.5 font-mono text-[11px] font-semibold text-[color:var(--red-text)]"
                  title="Human review required — approve or dismiss this risk in Safety Risk Review"
                >
                  Review
                </span>
              )}
            </button>

            {isOpen && (
              <div className="pl-[35px] pr-3 pt-0.5 pb-3 flex flex-col gap-3 min-w-0 anim-fade-up">
                <div className="flex items-center flex-wrap gap-2 text-[12.5px] text-ink-3">
                  Affected journey stage
                  <span className="chip chip-violet">{item.stage}</span>
                </div>

                <div>
                  <div className="mono-label">Why it matters</div>
                  <p className="mt-1 mb-0 text-[13px] leading-[1.5] text-ink-2 [text-wrap:pretty]">
                    {item.why_it_matters}
                  </p>
                </div>

                {item.next_steps.length > 0 && (
                  <div>
                    <div className="mono-label">Next steps</div>
                    <ol className="m-0 mt-1.5 p-0 list-none flex flex-col gap-1.5">
                      {item.next_steps.map((step, index) => (
                        <li
                          key={index}
                          className="flex gap-[9px] items-start text-[13px] leading-[1.5] text-ink-2"
                        >
                          <span className="w-[18px] h-[18px] flex-none mt-px rounded-full grid place-items-center font-mono text-[10.5px] font-semibold bg-[color:var(--green-bg)] text-[color:var(--step-coach)]">
                            {index + 1}
                          </span>
                          <span className="[text-wrap:pretty]">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {!readOnly && (
                  <div className="flex items-center gap-2 flex-wrap text-[12px] text-ink-muted">
                    {decision === "approved" ? (
                      <span className="chip chip-neutral !font-medium">Approved in Safety Risk Review</span>
                    ) : (
                      <span className="chip !h-[22px] !px-2 font-medium border border-[color:var(--red-border)] text-[color:var(--red-text)]">
                        Human review required
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {researchNext.length > 0 && (
        <div className="mt-2 pt-2 border-t border-line-divider flex flex-col gap-1.5 min-w-0">
          <div className="mono-label px-2.5 pt-1 pb-1">Research next</div>

          {researchNext.map((research) => {
            const isExpanded = expandedResearch === research.id;

            return (
              <div
                key={research.id}
                className={"acc-row" + (isExpanded ? " is-open" : "")}
              >
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpandedResearch(isExpanded ? null : research.id)
                  }
                  className="acc-head nodrag !items-start"
                >
                  <span className="mt-[3px]">
                    <CaretIcon className={"caret" + (isExpanded ? " is-open" : "")} />
                  </span>
                  <span className="flex-1 min-w-0 text-[13.5px] leading-[1.4] font-medium text-ink [text-wrap:pretty] [overflow-wrap:anywhere]">
                    {research.question}
                  </span>
                </button>

                {isExpanded && (
                  <div className="pl-[35px] pr-3 pt-0.5 pb-3 min-w-0 anim-fade-up">
                    <p className="m-0 text-[13px] leading-[1.5] text-ink-2 [overflow-wrap:anywhere]">
                      {research.why}
                    </p>

                    {!readOnly && research.risk_ids.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-2.5">
                        {research.risk_ids.map((riskId) => {
                          const risk = risks.find((r) => r.id === riskId);

                          return (
                            <span
                              key={riskId}
                              className="chip chip-neutral is-wrap"
                            >
                              {risk?.summary ?? riskId}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
