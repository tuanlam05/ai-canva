import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Evidence {
  quote: string;
  source: string;
}

interface Issue {
  theme_id: string;
  theme: string;
  description: string;
  sentiment: "positive" | "negative" | "neutral";
  evidence: Evidence[];
}

interface Stage {
  stage_name: string;
  stage_description: string;
  emotion: string;
  issues: Issue[];
}

interface JourneyMapperOutputProps {
  content: string;
}

const SENTIMENT_STYLES = {
  negative: {
    icon: "⚠",
    card: "border-red-100 bg-red-50/40",
    quote: "bg-red-50/60 border-red-300",
  },
  positive: {
    icon: "✓",
    card: "border-green-100 bg-green-50/40",
    quote: "bg-green-50/60 border-green-300",
  },
  neutral: {
    icon: "•",
    card: "border-slate-200 bg-slate-50",
    quote: "bg-slate-100 border-slate-300",
  },
} as const;

function styles(sentiment: string | undefined) {
  return (
    SENTIMENT_STYLES[sentiment as keyof typeof SENTIMENT_STYLES] ??
    SENTIMENT_STYLES.neutral
  );
}

export default function JourneyMapperOutput({
  content,
}: JourneyMapperOutputProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  let stages: Stage[] = [];
  let parseError = false;

  try {
    const parsed = JSON.parse(content);
    stages = Array.isArray(parsed.stages) ? parsed.stages : [];
  } catch {
    parseError = true;
  }

  if (parseError) {
    return (
      <div className="text-amber-600 text-base p-3 bg-amber-50 rounded-lg">
        ⚠️ Could not parse structured output. Showing raw text below.
        <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-500">
          {content}
        </pre>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="text-slate-400 text-base py-6 text-center">
        No journey stages found.
      </div>
    );
  }

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);

      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
      }

      return next;
    });
  };

  return (
    <div className="space-y-3 nowheel">
      <p className="text-[#8B93A5] font-inter text-base ms-1">
        {stages.length} stage{stages.length > 1 && "s"}
      </p>

      {stages.map((stage, i) => {
        const isOpen = expanded.has(i);
        const issues = stage.issues ?? [];

        const hasNegative = issues.some(
          (issue) => issue.sentiment === "negative",
        );

        return (
          <div
            key={i}
            className="border border-slate-200 rounded-lg overflow-hidden bg-white"
          >
            {/* stage header */}
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="text-slate-500 text-base flex-shrink-0 w-5 text-center transition-transform"
                  style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
                  aria-hidden
                >
                  ▶
                </span>

                <span className="font-semibold text-base text-slate-800 truncate">
                  {i + 1}. {stage.stage_name}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {hasNegative && (
                  <span className="text-sm text-[#C43F4C] font-bold bg-[#C43F4C]/[29%] px-2 py-1 rounded-md">
                    ⚠ Friction
                  </span>
                )}

                {stage.emotion && (
                  <span className="text-sm text-slate-500 uppercase">
                    {stage.emotion}
                  </span>
                )}
              </div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3">
                    <p className="text-sm leading-6 text-slate-600">
                      {stage.stage_description}
                    </p>

                    {issues.length === 0 && (
                      <div className="text-sm leading-6 text-slate-400 bg-slate-50 rounded-lg p-3 text-center">
                        No research evidence found for this stage.
                      </div>
                    )}

                    {issues.map((issue, j) => {
                      const s = styles(issue.sentiment);

                      return (
                        <div
                          key={issue.theme_id || j}
                          className={
                            "border rounded-lg p-3 space-y-3 " + s.card
                          }
                        >
                          <p className="text-sm font-semibold text-slate-800">
                            {s.icon} {issue.theme}
                          </p>

                          <p className="text-sm leading-6 text-slate-600">
                            {issue.description}
                          </p>

                          {issue.evidence?.map((ev, k) => (
                            <div
                              key={k}
                              className={
                                "text-sm leading-6 text-slate-700 rounded-tr-lg rounded-br-lg p-3 border-l-4 " +
                                s.quote
                              }
                            >
                              <p className="italic">&ldquo;{ev.quote}&rdquo;</p>

                              <p className="text-sm text-slate-500 mt-2">
                                — {ev.source}
                              </p>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
