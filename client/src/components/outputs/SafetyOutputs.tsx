import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Risk } from "../../types";
import { useBoardStore } from "../../store/boardStore";

interface SafetyReviewerOutputProps {
  content: string;
  boxId: string;
}

/**
 * Renders Patient Safety Reviewer's structured JSON output as reviewable
 * flag cards, plus a row per stage that was reviewed and found clear.
 *
 * Every risk is approved by default: a card with no recorded decision still
 * flows to UX Coach, it just doesn't count as reviewed. Approving marks it as
 * researcher-confirmed; dismissing (behind a confirm step) withholds it.
 */

/** Badge colours per risk category from the Reviewer's fixed list. */
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

export default function SafetyReviewerOutput({
  content,
  boxId,
}: SafetyReviewerOutputProps) {
  // Which card is mid-confirmation. Local state: a half-finished dismissal is
  // not a decision, so it never reaches the store or Firestore.
  const [confirming, setConfirming] = useState<string | null>(null);

  const setApproval = useBoardStore((s) => s.setApproval);
  const approvals = useBoardStore((s) => s.boxData[boxId]?.approvals);

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
      <div className="text-amber-600 text-sm p-2 bg-amber-50 rounded-lg">
        ⚠️ Could not parse structured output. Showing raw text below.
        <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
          {content}
        </pre>
      </div>
    );
  }

  if (risks.length === 0 && clearStages.length === 0) {
    return (
      <div className="text-slate-400 text-sm py-4 text-center">
        No safety review produced.
      </div>
    );
  }

  // Counted from the risks array rather than the approvals map so decisions
  // left over from a previous run can never inflate the total.
  const reviewedCount = risks.filter((r) => approvals?.[r.id]).length;

  return (
    <div className="space-y-2 nowheel">
      <div className="ms-1">
        <p className="text-[#8B93A5] font-inter text-sm">
          {risks.length} flag{risks.length === 1 ? "" : "s"} ·{" "}
          {clearStages.length} stage{clearStages.length === 1 ? "" : "s"} clear
        </p>
        <p className="text-[#8B93A5] font-inter text-xs">
          {reviewedCount} of {risks.length} risk
          {risks.length === 1 ? "" : "s"} reviewed
        </p>
      </div>

      {risks.map((risk) => {
        const decision = approvals?.[risk.id]?.status;
        const isDismissed = decision === "dismissed";
        const isConfirming = confirming === risk.id;

        return (
          <div
            key={risk.id}
            className="border border-slate-200 rounded-lg p-3 space-y-2 bg-white transition"
          >
            {/* Only the flag's content fades when dismissed — the buttons stay
              at full strength, since opacity is inherited and a child can
              never be more opaque than its parent. */}
            <div
              className={
                "space-y-2 transition " + (isDismissed ? "opacity-50" : "")
              }
            >
              {/* Category + review status */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={
                    "text-xs font-bold px-2 py-0.5 rounded-md " +
                    categoryStyle(risk.category)
                  }
                >
                  {risk.category}
                </span>
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

              <p className="text-sm font-medium text-slate-700">
                {risk.summary}
              </p>

              <p className="text-xs text-slate-400">
                affected journey stage{" "}
                <span className="text-xs font-medium text-[#6b5bd6] bg-[#a78bfa]/20 px-1.5 py-0.5 rounded-md">
                  {risk.stage}
                </span>
              </p>

              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  Reason for flagging
                </p>
                <p className="text-xs text-slate-600">{risk.reason}</p>
              </div>

              {/* Evidence trace: stage → theme → the original quote. */}
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  Evidence trace
                </p>
                <div className="flex items-center gap-1 flex-wrap text-xs text-slate-600">
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded-md">
                    {risk.stage}
                  </span>
                  <span className="text-slate-300">→</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded-md">
                    {risk.theme}
                  </span>
                  <span className="text-slate-300">→</span>
                </div>
                {risk.evidence?.map((ev, i) => (
                  <div
                    key={i}
                    className="text-xs text-slate-600 bg-blue-50/60 rounded-tr-lg rounded-br-lg p-2 border-l-4 border-blue-300"
                  >
                    <p className="italic">&ldquo;{ev.quote}&rdquo;</p>
                    <p className="text-slate-400 mt-1">— {ev.source}</p>
                  </div>
                ))}
                <p className="text-[11px] text-slate-300 uppercase tracking-wide">
                  Read-only
                </p>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {isConfirming ? (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-2"
                >
                  <p className="text-xs text-slate-600">
                    Remove this flag from UX Coach&apos;s advice?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setApproval(boxId, risk.id, "dismissed");
                        setConfirming(null);
                      }}
                      className="text-xs text-white bg-[#C43F4C] hover:bg-red-500 rounded-md px-3 py-1 transition"
                    >
                      Yes, dismiss
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      className="text-xs text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-md px-3 py-1 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="actions"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="flex gap-2"
                >
                  <button
                    onClick={() => setApproval(boxId, risk.id, "approved")}
                    className={
                      "text-xs rounded-md px-3 py-1 transition " +
                      (decision === "approved"
                        ? "text-white bg-[#2563eb] hover:bg-blue-500"
                        : "text-slate-600 border border-slate-300 hover:bg-slate-50")
                    }
                  >
                    Approve
                  </button>
                  {!isDismissed && (
                    <button
                      onClick={() => setConfirming(risk.id)}
                      className="text-xs text-slate-600 border border-slate-300 hover:bg-slate-50 rounded-md px-3 py-1 transition"
                    >
                      Dismiss
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {/* Stages the reviewer checked and found clear. */}
      {clearStages.map((stage) => (
        <div
          key={stage}
          className="flex items-center gap-2 border border-dashed border-slate-200 rounded-lg px-3 py-2"
        >
          <span className="text-xs font-medium text-[#6b5bd6] bg-[#a78bfa]/20 px-1.5 py-0.5 rounded-md flex-shrink-0">
            {stage}
          </span>
          <span className="text-xs text-slate-400">
            No safety concerns identified for this stage
          </span>
        </div>
      ))}
    </div>
  );
}
