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
  issues: Issue[];
}

interface JourneyMapperOutputProps {
  content: string;
}

// Full class names as literals so Tailwind's scanner picks them up
const SENTIMENT_STYLES = {
  negative: {icon: "⚠", card: "border-red-100 bg-red-50/40", quote: "bg-red-50/60 border-red-300"},
  positive: { icon: "✓", card: "border-green-100 bg-green-50/40", quote: "bg-green-50/60 border-green-300" },
  neutral: { icon: "•", card: "border-slate-200 bg-slate-50", quote: "bg-slate-100 border-slate-300" },
} as const;

function styles(sentiment: string | undefined) {
  return SENTIMENT_STYLES[sentiment as keyof typeof SENTIMENT_STYLES] ?? SENTIMENT_STYLES.neutral;
}

export default function JourneyMapperOutput({ content }: JourneyMapperOutputProps) {
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
        <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{content}</pre>
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
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="relative pl-2">
      {stages.map((stage, i) => {
        const isOpen = expanded.has(i);
        const hasIssues = stage.issues && stage.issues.length > 0;
        const totalCount = stage.issues?.length ?? 0;
        const isLast = i === stages.length - 1;
        // Dot colour: red if any negative finding, green if only positive,
        // grey when empty or neutral.
        const hasNegative = stage.issues?.some((iss) => iss.sentiment === "negative");
        const hasPositive = stage.issues?.some((iss) => iss.sentiment === "positive");
        const dotClass = hasNegative
          ? "border-red-400 bg-red-50"
          : hasPositive
            ? "border-green-400 bg-green-50"
            : "border-slate-300 bg-white";

        return (
          <div key={i} className="relative flex gap-3">
            {/* Timeline dot + connecting line */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={"w-3 h-3 rounded-sm border-2 mt-1.5 " + dotClass} />
              {!isLast && <div className="w-px flex-1 bg-slate-200 my-0.5" />}
            </div>

            {/* Stage content */}
            <div className={"flex-1 min-w-0 " + (isLast ? "" : "pb-2")}>
              <button
                onClick={() => toggle(i)}
                className="w-full text-left rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-slate-100 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-700 truncate">
                    {i + 1}. {stage.stage_name}
                  </span>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {isOpen ? "▾" : "▸"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 truncate">
                  {hasIssues
                    ? `${totalCount} finding${totalCount > 1 ? "s" : ""}`
                    : "No findings at this stage"}
                </p>
              </button>

              {isOpen && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-slate-500 italic">{stage.stage_description}</p>

                  {!hasIssues && (
                    <div className="text-xs text-slate-400 bg-slate-50 rounded-lg p-2 text-center">
                      No research evidence found for this stage.
                    </div>
                  )}

                  {hasIssues &&
                    stage.issues.map((issue, j) => {
                      const s = styles(issue.sentiment);
                      return (
                      <div
                        key={j}
                        className={"border rounded-lg p-2 space-y-1 " + s.card}
                      >
                        <p className="text-xs font-medium text-slate-700">
                          {s.icon} {issue.theme}
                        </p>
                        <p className="text-xs text-slate-500">{issue.description}</p>
                        {issue.evidence?.map((ev, k) => (
                          <div
                            key={k}
                            className={"text-xs text-slate-600 rounded p-1.5 border-l-2 " + s.quote}
                          >
                            <p className="italic">&ldquo;{ev.quote}&rdquo;</p>
                            <p className="text-slate-400 mt-0.5">— {ev.source}</p>
                          </div>
                        ))}
                      </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}