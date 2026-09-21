import { useState } from "react";

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
    SENTIMENT_STYLES[
      sentiment as keyof typeof SENTIMENT_STYLES
    ] ?? SENTIMENT_STYLES.neutral
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
      <div className="text-amber-600 text-sm p-2 bg-amber-50 rounded-lg">
        ⚠️ Could not parse structured output. Showing raw text below.
        <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
          {content}
        </pre>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="text-slate-400 text-sm py-4 text-center">
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
    <div className="space-y-2 nowheel">
      {stages.map((stage, i) => {
        const isOpen = expanded.has(i);
        const issues = stage.issues ?? [];

        const hasNegative = issues.some(
          (issue) => issue.sentiment === "negative"
        );

        return (
          <div
            key={i}
            className="border border-slate-200 rounded-lg overflow-hidden bg-white"
          >
            {/* stage header */}
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-slate-400 text-xs flex-shrink-0">
                  {isOpen ? "▾" : "▸"}
                </span>

                <span className="font-medium text-sm text-slate-700 truncate">
                  {i + 1}. {stage.stage_name}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                {hasNegative && (
                  <span className="text-xs text-[#C43F4C] font-bold bg-[#C43F4C]/[29%] px-1.5 py-0.5 rounded-md">
                    ⚠ Friction
                  </span>
                )}

                {stage.emotion && (
                  <span className="text-xs text-slate-500 uppercase">
                    {stage.emotion}
                  </span>
                )}
              </div>
            </button>

            {isOpen && (
              <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2">
                <p className="text-xs text-slate-500">
                  {stage.stage_description}
                </p>

                {issues.length === 0 && (
                  <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-2 text-center">
                    No research evidence found for this stage.
                  </div>
                )}

                {issues.map((issue, j) => {
                  const s = styles(issue.sentiment);

                  return (
                    <div
                      key={issue.theme_id || j}
                      className={"border rounded-lg p-2 space-y-2 " + s.card}
                    >
                      <p className="text-xs font-medium text-slate-700">
                        {s.icon} {issue.theme}
                      </p>

                      <p className="text-xs text-slate-500">
                        {issue.description}
                      </p>

                      {issue.evidence?.map((ev, k) => (
                        <div
                          key={k}
                          className={
                            "text-xs text-slate-600 rounded-tr-lg rounded-br-lg p-2 border-l-4 " +
                            s.quote
                          }
                        >
                          <p className="italic">
                            &ldquo;{ev.quote}&rdquo;
                          </p>

                          <p className="text-slate-400 mt-1">
                            — {ev.source}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}