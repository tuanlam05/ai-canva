import { useState } from "react";
import type { Theme } from "../../types";
import { useBoardStore } from "../../store/boardStore";
import { sourceCode } from "../../lib/nodeView";
import { AlertIcon, CaretIcon, RerunIcon, Spinner } from "../ui/icons";

interface InsightWeaverOutputProps {
  content: string;
  boxId: string;
  /** An earlier version (see VersionHistory): shown without per-theme Rerun. */
  readOnly?: boolean;
}

/**
 * Theme Finder (Insight Weaver) themes as cards, ranked by how many
 * supporting quotes they have (shown as a count). One card open at a time;
 * all start closed. Each card has its own Rerun, except on earlier versions.
 */
export default function InsightWeaverOutput({
  content,
  boxId,
  readOnly = false,
}: InsightWeaverOutputProps) {
  // Accordion: index into the ORIGINAL themes array (null = all closed).
  const [openTheme, setOpenTheme] = useState<number | null>(null);
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

  // Rank by supporting quotes, highest first. Keep each theme's original
  // index: the store's rerunTheme addresses themes by their position in the
  // output.
  const ranked = themes
    .map((theme, index) => ({ theme, index, count: theme.evidence?.length ?? 0 }))
    .sort((a, b) => b.count - a.count || a.index - b.index);

  return (
    <div className="nowheel px-2 pt-1 pb-2.5">
      {parseError ? (
        <div className="m-2 p-3 rounded-lg bg-[color:var(--amber-bg)] text-[color:var(--amber-text)] text-[13px]">
          <span className="flex items-center gap-1.5 font-semibold">
            <AlertIcon /> Could not parse structured output. Showing raw text below.
          </span>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[11.5px] text-ink-3">
            {content}
          </pre>
        </div>
      ) : themes.length === 0 ? (
        <div className="text-ink-muted text-[13px] py-8 text-center">
          No themes found in the research material.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between pt-2 pb-0.5 pl-[35px] pr-3 mono-label">
            <span>Theme</span>
            <span>Quotes</span>
          </div>
          {ranked.map(({ theme, index: i, count }) => {
            const isOpen = openTheme === i;
            const isRegenerating = regeneratingIndex === i;
            return (
              <div key={i} className={"acc-row" + (isOpen ? " is-open" : "")}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isOpen}
                  onClick={() => setOpenTheme(isOpen ? null : i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenTheme(isOpen ? null : i);
                    }
                  }}
                  className="acc-head nodrag"
                >
                  <CaretIcon className={"caret" + (isOpen ? " is-open" : "")} />
                  <span className="flex-1 min-w-0 text-[13.5px] leading-[1.35] font-medium text-ink [text-wrap:pretty]">
                    {isRegenerating ? (
                      <span className="inline-flex items-center gap-1.5 text-ink-muted">
                        <Spinner /> Regenerating…
                      </span>
                    ) : (
                      theme.theme
                    )}
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReject(i);
                      }}
                      disabled={regeneratingIndex !== null}
                      className="btn btn-secondary btn-sm !h-[26px] !px-2 flex-none"
                      title="Reject & regenerate this theme"
                    >
                      <RerunIcon size={12} /> Rerun
                    </button>
                  )}
                  <span
                    className="min-w-[26px] h-[22px] px-1.5 flex-none grid place-items-center rounded-[6px] bg-surface-muted font-mono text-[12px] font-semibold text-ink"
                    title={`${count} supporting ${count === 1 ? "quote" : "quotes"}`}
                  >
                    {count}
                  </span>
                </div>

                {isOpen && (
                  <div className="pl-[35px] pr-3 pt-0.5 pb-3 flex flex-col gap-1.5 anim-fade-up">
                    {theme.description && (
                      <p className="m-0 mb-0.5 text-[13px] leading-[1.5] text-ink-2 [text-wrap:pretty]">
                        {theme.description}
                      </p>
                    )}
                    {theme.evidence?.map((ev, j) => (
                      <div
                        key={j}
                        className="flex gap-2.5 items-start bg-surface-sunken rounded-lg px-[11px] py-[9px] text-[12.5px] leading-[1.5] text-[color:var(--quote-text)]"
                      >
                        <span
                          className="flex-none mt-px font-mono text-[10.5px] font-semibold px-[5px] py-px rounded bg-ink text-on-ink"
                          title={ev.source}
                        >
                          {sourceCode(ev.source)}
                        </span>
                        <span className="flex-1 min-w-0">
                          &ldquo;{ev.quote}&rdquo;
                          <span
                            title={
                              ev.verified
                                ? "This quote appears word for word in the source transcript."
                                : "This quote does not match the transcript exactly — the wording may have been altered. Check it against the source before using it."
                            }
                            className={
                              "ml-1.5 align-middle inline-flex items-center h-[18px] px-1.5 rounded font-mono text-[10.5px] font-semibold uppercase tracking-[.04em] cursor-help " +
                              (ev.verified
                                ? "bg-surface-muted text-ink-muted"
                                : "bg-[color:var(--amber-bg)] text-[color:var(--amber-text)]")
                            }
                          >
                            {ev.verified ? "Verified" : "Unverified"}
                          </span>
                        </span>
                      </div>
                    ))}
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
