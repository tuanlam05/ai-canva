import { useState } from "react";

interface Evidence {
  quote: string;
  source: string;
}

interface Theme {
  theme: string;
  description: string;
  evidence: Evidence[];
}

interface InsightWeaverOutputProps {
  content: string;
}

/**
 * Renders Insight Weaver's structured JSON output as collapsible theme cards.
 * Each card shows the theme name + evidence count when collapsed, and expands
 * to show every verbatim quote with its source when clicked.
 */
export default function InsightWeaverOutput({
  content,
}: InsightWeaverOutputProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  let themes: Theme[] = [];
  let parseError = false;

  try {
    const parsed = JSON.parse(content);
    themes = Array.isArray(parsed.themes) ? parsed.themes : [];
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

  if (themes.length === 0) {
    return (
      <div className="text-slate-400 text-sm py-4 text-center">
        No themes found in the research material.
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
    <div className="space-y-2 nowheel">
      {themes.map((theme, i) => {
        const isOpen = expanded.has(i);
        return (
          <div
            key={i}
            className="border border-slate-200 rounded-lg overflow-hidden bg-white"
          >
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-slate-400 text-xs flex-shrink-0">
                  {isOpen ? "▾" : "▸"}
                </span>
                <span className="font-medium text-sm text-slate-700 truncate">
                  {theme.theme}
                </span>
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0 ml-2 bg-slate-100 px-1.5 py-0.5 rounded-full">
                {theme.evidence?.length ?? 0}
              </span>
            </button>

            {isOpen && (
              <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2">
                <p className="text-xs text-slate-500">{theme.description}</p>
                {theme.evidence?.map((ev, j) => (
                  <div
                    key={j}
                    className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 border-l-2 border-blue-300"
                  >
                    <p className="italic">&ldquo;{ev.quote}&rdquo;</p>
                    <p className="text-slate-400 mt-1">— {ev.source}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
