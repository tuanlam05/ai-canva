import { useState, type ReactNode } from "react";
import type { BoxData, BoxType, HistoryEntry } from "../../types";
import { resultSummary, safetyReviewCounts } from "../../lib/nodeView";
import { formatVersionTime } from "../../lib/versions";
import { CaretIcon, CheckIcon, ChevronLeftIcon, CloseIcon, RerunIcon } from "../ui/icons";

interface VersionHistoryProps {
  boxType: BoxType;
  data: BoxData;
  /** Draws one version's output, read-only. */
  renderVersion: (entry: HistoryEntry) => ReactNode;
  onRestore: (versionId: string) => void;
  onClose: () => void;
}

/**
 * An AI box's version history, shown in place of its output. It lists every
 * version, newest first, with when it was made and what it produced. You can
 * open an earlier version read-only and restore it. Restoring keeps every
 * version, so you can always switch back.
 */
export default function VersionHistory({
  boxType,
  data,
  renderVersion,
  onRestore,
  onClose,
}: VersionHistoryProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const versions = data.history ?? [];
  // Numbered oldest first; listed newest first.
  const numbered = versions.map((entry, i) => ({ entry, number: i + 1 })).reverse();
  const open = numbered.find((version) => version.entry.id === openId);

  const summary = (entry: HistoryEntry) => {
    const text = resultSummary(boxType, entry.output) ?? "Output in an unexpected format";
    if (boxType !== "safety") return text;
    // The current version's decisions live on the box; the others' on their entry.
    const approvals = entry.id === data.currentVersionId ? data.approvals : entry.approvals;
    const reviewed = safetyReviewCounts(entry.output, approvals)?.reviewed ?? 0;
    return reviewed ? `${text} · ${reviewed} reviewed` : text;
  };

  if (open) {
    return (
      <div className="nowheel">
        <div className="mx-2.5 mt-2.5 mb-1 px-3 py-2.5 rounded-[10px] bg-surface-sunken flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setOpenId(null);
                setConfirming(false);
              }}
              className="nodrag btn btn-secondary btn-sm !h-7 !px-2 flex-none"
              title="Back to all versions"
            >
              <ChevronLeftIcon /> All versions
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] leading-[1.3] font-semibold text-ink">
                Version {open.number}
              </div>
              <div className="font-mono text-[11px] text-ink-muted truncate">
                {formatVersionTime(open.entry.timestamp)} · read-only
              </div>
            </div>
            {!confirming && (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="nodrag btn btn-primary btn-sm flex-none"
              >
                <RerunIcon /> Restore
              </button>
            )}
          </div>
          {confirming && (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="m-0 flex-1 min-w-[180px] text-[12.5px] leading-[1.45] text-ink-3 [text-wrap:pretty]">
                Make version {open.number} the current one? The other versions stay here.
              </p>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="nodrag btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onRestore(open.entry.id)}
                className="nodrag btn btn-primary btn-sm"
              >
                Restore
              </button>
            </div>
          )}
        </div>
        <div key={open.entry.id} className="anim-fade-up">
          {renderVersion(open.entry)}
        </div>
      </div>
    );
  }

  return (
    <div className="nowheel px-2.5 pt-2 pb-2.5">
      <div className="flex items-center gap-2 pl-0.5 pb-2">
        <span className="mono-label">Version history</span>
        <span className="font-mono text-[11px] text-ink-faint">{versions.length}</span>
        <button
          type="button"
          onClick={onClose}
          className="nodrag ml-auto btn btn-secondary btn-sm btn-icon !w-7 !h-7"
          title="Back to the current version"
          aria-label="Close version history"
        >
          <CloseIcon />
        </button>
      </div>

      <ol className="m-0 p-0 list-none flex flex-col gap-1.5">
        {numbered.map(({ entry, number }) => {
          const isCurrent = entry.id === data.currentVersionId;
          return (
            <li key={entry.id}>
              <button
                type="button"
                disabled={isCurrent}
                aria-current={isCurrent || undefined}
                onClick={() => setOpenId(entry.id)}
                className={
                  "nodrag w-full text-left px-3 py-2.5 rounded-[10px] border bg-surface flex items-center gap-2.5 transition-colors " +
                  (isCurrent ? "border-line cursor-default" : "border-line-soft hover:bg-surface-sunken")
                }
                title={isCurrent ? "The version this box shows now" : "Open this version"}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] leading-[1.3] font-semibold text-ink">
                      Version {number}
                    </span>
                    {isCurrent && (
                      <span className="status-pill">
                        <CheckIcon /> Current
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-muted truncate">{summary(entry)}</div>
                </div>
                <span className="flex-none font-mono text-[11px] text-ink-muted tabular-nums">
                  {formatVersionTime(entry.timestamp)}
                </span>
                {!isCurrent && <CaretIcon className="caret" />}
              </button>
            </li>
          );
        })}
      </ol>

      {versions.length === 1 && (
        <p className="m-0 mt-2.5 pl-0.5 text-[12px] leading-[1.5] text-ink-muted [text-wrap:pretty]">
          Each run adds a version here, so you can look back at earlier results and restore one.
        </p>
      )}
    </div>
  );
}
