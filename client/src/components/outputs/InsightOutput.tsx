import { useState, useEffect } from "react";
import type { Theme } from "../../types";
import { useBoardStore } from "../../store/boardStore";
import { motion, AnimatePresence } from "framer-motion";

interface InsightWeaverOutputProps {
  content: string;
  boxId: string;
  showHistory: boolean;
  onRevertComplete?: () => void;
}

export default function InsightWeaverOutput({
  content,
  boxId,
  showHistory,
  onRevertComplete,
}: InsightWeaverOutputProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(
    null,
  );
  const [viewingVersion, setViewingVersion] = useState<string | null>(null);
  const [showConfirmRevert, setShowConfirmRevert] = useState(false);

  const rerunTheme = useBoardStore((s) => s.rerunTheme);
  const revertToVersion = useBoardStore((s) => s.revertToVersion);
  const boxData = useBoardStore((s) => s.boxData[boxId]);

  useEffect(() => {
    if (!showHistory) setViewingVersion(null);
  }, [showHistory]);

  async function handleReject(themeIndex: number) {
    setRegeneratingIndex(themeIndex);
    await rerunTheme(boxId, themeIndex);
    setRegeneratingIndex(null);
  }

  const viewingEntry =
    viewingVersion !== null
      ? boxData.history?.find((entry) => entry.id === viewingVersion)
      : null;

  const displayContent = viewingEntry?.output ?? content;

  let themes: Theme[] = [];
  let parseError = false;

  try {
    const parsed = JSON.parse(displayContent);
    themes = Array.isArray(parsed.themes) ? parsed.themes : [];
  } catch {
    parseError = true;
  }

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const renderThemeCards = (readOnly: boolean) => (
    <>
      {parseError ? (
        <div className="text-amber-600 text-sm p-2 bg-amber-50 rounded-lg">
          ⚠️ Could not parse structured output. Showing raw text below.
          <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-500">
            {displayContent}
          </pre>
        </div>
      ) : themes.length === 0 ? (
        <div className="text-slate-400 text-sm py-4 text-center">
          No themes found in the research material.
        </div>
      ) : (
        themes.map((theme, i) => {
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
                  {!readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReject(i);
                      }}
                      disabled={regeneratingIndex !== null}
                      className={`text-white rounded-md text-xs px-3 py-1 transition ${
                        regeneratingIndex === i
                          ? "bg-blue-100"
                          : "bg-[#60a5fa] hover:bg-blue-300"
                      }`}
                      title="Reject & regenerate"
                    >
                      Rerun
                    </button>
                  )}
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
                          <p className="text-slate-400 mt-1">
                            — {ev.source}
                            <span
                              className={
                                "text-xs px-2 py-0.5 rounded-md border ml-2 " +
                                (ev.verified === true
                                  ? "border-green-300 text-green-700"
                                  : "border-yellow-300 text-yellow-600")
                              }
                            >
                              {ev.verified === true ? "Verified" : "Unverified"}
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })
      )}
    </>
  );

  return (
    <div className="space-y-2 nowheel">
      <AnimatePresence mode="wait">
        {viewingVersion !== null ? (
          <motion.div
            key="viewing-version"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center justify-between px-2 py-1.5 mb-2 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <button
                onClick={() => setViewingVersion(null)}
                className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium"
                title="Back to history list"
              >
                ←{" "}
                {viewingEntry &&
                  new Date(viewingEntry.timestamp).toLocaleString()}
              </button>
              <button
                onClick={() => setShowConfirmRevert(true)}
                className="text-amber-700 font-medium hover:text-amber-900 px-2 py-0.5 rounded hover:bg-amber-100 transition"
              >
                Revert
              </button>
            </div>
            {renderThemeCards(true)}
          </motion.div>
        ) : showHistory ? (
          <motion.div
            key="history-list"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            {!boxData.history?.length ? (
              <div className="text-slate-400 text-sm py-6 text-center">
                No history yet.
              </div>
            ) : (
              <div className="space-y-1.5">
                {boxData.history.map((entry) => {
                  const isCurrent = entry.id === boxData.currentVersionId;

                  return (
                    <button
                      key={entry.id}
                      onClick={() => setViewingVersion(entry.id)}
                      disabled={isCurrent}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${
                        isCurrent
                          ? "border-blue-200 bg-blue-50 text-blue-700 cursor-default"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>

                        {isCurrent && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide">
                            current
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="main-content"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            {renderThemeCards(false)}
          </motion.div>
        )}
      </AnimatePresence>

      {showConfirmRevert && (
        <div
          className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          onClick={() => setShowConfirmRevert(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl p-4 shadow-lg max-w-xs"
          >
            <p className="text-sm text-slate-700 mb-3">
              Revert to this version?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirmRevert(false)}
                className="text-xs px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  revertToVersion(boxId, viewingVersion!);
                  setShowConfirmRevert(false);
                  setViewingVersion(null);
                  onRevertComplete?.();
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                Revert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
