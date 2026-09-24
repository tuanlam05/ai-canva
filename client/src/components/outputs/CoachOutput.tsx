import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Risk } from "../../types";
import { useBoardStore } from "../../store/boardStore";

interface CoachOutputProps {
  content: string;
  boxId: string;
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

const CATEGORY_STYLES: Record<string, string> = {
  "Communication Risk": "bg-red-100 text-red-800",
  "Continuity of Care Risk": "bg-amber-100 text-amber-800",
  "Medication Risk": "bg-purple-100 text-purple-800",
  "Access Risk": "bg-blue-100 text-blue-800",
  "Data Accuracy Risk": "bg-teal-100 text-teal-800",
};

function categoryStyle(category: string): string {
  return CATEGORY_STYLES[category] ?? "bg-slate-100 text-slate-700";
}

export default function CoachOutput({ content, boxId }: CoachOutputProps) {
  const [expandedResearch, setExpandedResearch] = useState<string | null>(null);

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
      <div className="text-amber-600 text-sm p-2 bg-amber-50 rounded-lg">
        ⚠️ Could not parse structured output. Showing raw text below.
        <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
          {content}
        </pre>
      </div>
    );
  }

  const visibleGuidance = guidance.filter((item) => {
    const risk = risks.find((r) => r.id === item.risk_id);

    if (!risk) return false;

    const decision = approvals?.[item.risk_id]?.status;

    return decision !== "dismissed";
  });

  if (guidance.length === 0 && researchNext.length === 0) {
    return (
      <div className="text-slate-400 text-sm py-4 text-center">
        No guidance produced.
      </div>
    );
  }

  return (
    <div className="space-y-2 nowheel">
      <div className="w-full rounded-md bg-[#F3FAF9] border-[#F1F9E3] border-2 p-2">
        <p className="text-[#2F6F68] font-inter text-[11.5px]">
          Advisory only. Nothing here changes the pipeline output.
        </p>
      </div>

      {visibleGuidance.length === 0 && researchNext.length === 0 && (
        <div className="text-slate-400 text-sm py-4 text-center">
          All guidance has been dismissed in Safety Reviewer.
        </div>
      )}

      <AnimatePresence initial={false}>
        {visibleGuidance.map((item) => {
          const risk = risks.find((r) => r.id === item.risk_id);

          if (!risk) return null;

          const decision = approvals?.[item.risk_id]?.status;
          const isDismissed = decision === "dismissed";

          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="border border-slate-200 rounded-lg p-3 space-y-3 bg-white"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={
                    "text-xs font-bold px-2 py-0.5 rounded-md " +
                    categoryStyle(risk.category)
                  }
                >
                  Responds to · {risk.category}
                </span>
              </div>

              <p className="text-sm font-semibold text-slate-700 mt-2">
                {item.plain_summary}
              </p>

              <div className="mt-2">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  Affected journey stage
                </p>

                <p className="text-xs text-slate-600 mt-1">{item.stage}</p>
              </div>

              <div className="mt-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  Why it matters
                </p>

                <p className="text-xs text-slate-600 mt-1">
                  {item.why_it_matters}
                </p>
              </div>

              {item.next_steps.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    Next steps
                  </p>

                  <ul className="mt-1 space-y-1">
                    {item.next_steps.map((step, index) => (
                      <li
                        key={index}
                        className="text-xs text-slate-600 flex gap-2"
                      >
                        <span className="text-[#84cc16]">•</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span
                  className={
                    "text-xs px-2 py-0.5 rounded-md border " +
                    (decision === "approved"
                      ? "border-green-300 text-green-700"
                      : isDismissed
                        ? "border-slate-300 text-slate-500"
                        : "border-red-300 text-red-600")
                  }
                >
                  {decision === "approved"
                    ? "Approved"
                    : isDismissed
                      ? "Dismissed"
                      : "Human review required"}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {researchNext.length > 0 && (
        <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-3">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            Research next
          </p>

          {researchNext.map((research) => {
            const isExpanded = expandedResearch === research.id;

            return (
              <div
                key={research.id}
                className="border border-slate-100 rounded-md"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedResearch(isExpanded ? null : research.id)
                  }
                  className="w-full text-left p-2.5 hover:bg-slate-50 rounded-md transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-slate-700">
                      {research.question}
                    </p>

                    <span className="text-xs text-slate-400">
                      {isExpanded ? "-" : "+"}
                    </span>
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="px-2.5 pb-2.5">
                        <p className="text-xs text-slate-500">{research.why}</p>

                        {research.risk_ids.length > 0 && (
                          <div className="flex gap-1.5 flex-wrap mt-2">
                            {research.risk_ids.map((riskId) => {
                              const risk = risks.find((r) => r.id === riskId);

                              return (
                                <span
                                  key={riskId}
                                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500"
                                >
                                  {risk?.summary ?? riskId}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
