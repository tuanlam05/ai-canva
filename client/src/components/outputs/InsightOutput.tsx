import { useState } from "react";
import type { Theme } from "../../types";
import { useBoardStore } from "../../store/boardStore";
import { motion, AnimatePresence } from "framer-motion";

interface InsightWeaverOutputProps {
  content: string;
  boxId: string;
}

/**
 * Renders Insight Weaver's structured JSON output as collapsible theme cards.
 * Each card shows the theme name + evidence count when collapsed, and expands
 * to show every verbatim quote with its source when clicked.
 */
export default function InsightWeaverOutput({
  content,
  boxId,
}: InsightWeaverOutputProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(
    null,
  );

  const rerunTheme = useBoardStore((s) => s.rerunTheme);

  async function handleReject(themeIndex: number) {
    setRegeneratingIndex(themeIndex);
    await rerunTheme(boxId, themeIndex);
    setRegeneratingIndex(null);
  }

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
                <AnimatePresence mode="wait">
                  <motion.span
                    key={regeneratingIndex === i ? "loading" : "theme"}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="font-medium text-sm text-slate-700 truncate inline-block"
                  >
                    {regeneratingIndex === i
                      ? "⏳ Regenerating..."
                      : theme.theme}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReject(i);
                  }}
                  disabled={regeneratingIndex !== null}
                  className={`text-white rounded-md text-xs px-3 py-1 transition ${regeneratingIndex===i ? "bg-blue-100" : "bg-[#60a5fa] hover:bg-blue-300"}`}
                  title="Reject & regenerate"
                >
                  Rerun
                </button>
                <span className="text-xs text-blue-700 font-bold flex-shrink-0 ml-2 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  {theme.evidence?.length ?? 0}
                </span>
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
                  <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2">
                    <p className="text-xs text-slate-500">
                      {theme.description}
                    </p>
                    {theme.evidence?.map((ev, j) => (
                      <div
                        key={j}
                        className="text-xs text-slate-600 bg-slate-50 rounded-tr-lg rounded-br-lg p-2 border-l-4 border-blue-300"
                      >
                        <p className="italic">&ldquo;{ev.quote}&rdquo;</p>
                        <p className="text-slate-400 mt-1">— {ev.source}</p>
                      </div>
                    ))}
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
