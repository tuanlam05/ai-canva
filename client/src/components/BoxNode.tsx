import { memo, useState, useRef } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import { useBoardStore } from "../store/boardStore.js";
import { BOX_TYPES, LABEL_COLORS } from "../types.js";
import type { BoxType, HistoryEntry } from "../types.js";
import ChecklistPanel from "./ChecklistPanel.js";
import {
  SUPPORTED_DOC_EXTS,
  clampDocText,
  docExt,
  extractDocumentText,
  formatBytes,
  makeDocId,
  remainingDocBudget,
} from "../lib/documents.js";
import type { BoxDocument } from "../types.js";
import InsightWeaverOutput from "./outputs/InsightOutput.js";
import JourneyMapperOutput from "./outputs/JourneyOutput.js";
import SafetyReviewerOutput from "./outputs/SafetyOutputs.js";
import CoachOutput from "./outputs/CoachOutput.js";
import VersionHistory from "./outputs/VersionHistory.js";
import SummaryOutput, { useSummaryReport } from "./outputs/SummaryOutput.js";
import { reportSections } from "../lib/summaryReport.js";
import { Tooltip } from "./ui/Tooltip.js";
import { Menu, MenuItem } from "./ui/Menu.js";
import {
  AlertIcon,
  CheckIcon,
  FileIcon,
  HistoryIcon,
  MoreIcon,
  PlayIcon,
  RerunIcon,
  SettingsIcon,
  Spinner,
  TrashIcon,
  UploadIcon,
  CloseIcon,
  BoxIcon,
} from "./ui/icons.js";
import {
  BOX_USAGE,
  EMPTY_STATE_COPY,
  GROUP_LABEL_COLOR,
  STEP_STYLE,
  coachReviewCounts,
  displayTitle,
  resultSummary,
  safetyReviewCounts,
  tileText,
} from "../lib/nodeView.js";

function BoxNode({ id, data, selected, type }: NodeProps) {
  const boxType = (data.boxType || type) as BoxType;
  const meta = BOX_TYPES[boxType];
  const boxData = useBoardStore((s) => s.boxData[id]);
  const updateBoxData = useBoardStore((s) => s.updateBoxData);
  const deleteBox = useBoardStore((s) => s.deleteBox);
  const runBox = useBoardStore((s) => s.runBox);
  const revertToVersion = useBoardStore((s) => s.revertToVersion);
  const edges = useBoardStore((s) => s.edges);
  const allNodes = useBoardStore((s) => s.nodes);
  const setBoxName = useBoardStore((s) => s.setBoxName);
  const isStale = useBoardStore((state) => state.isBoxStale(id));
  const allBoxData = useBoardStore((s) => s.boxData);
  // PDF Summary: the report built live from the pipeline outputs.
  const summaryReport = useSummaryReport(
    ((data.boxType || type) as BoxType) === "summary",
  );
  const summarySectionCount = reportSections(summaryReport).length;

  const [showSettings, setShowSettings] = useState(false);
  // Documents box: how many files are mid-extraction right now (transient UI
  // state — the durable results live in boxData.documents).
  const [docBusy, setDocBusy] = useState(0);
  const [docDragOver, setDocDragOver] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  // Label box: click-to-edit text (same pattern as the box-name editor).
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState("");
  // Version history (AI boxes) replaces the output while open. It remembers
  // the version it was opened on, so a new run or a restore — anything that
  // changes the current version — closes it.
  const [historyOpenedAt, setHistoryOpenedAt] = useState<string | null>(null);
  // Text box: 3-line excerpt vs full (editable) transcript. View state only.
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  if (!meta) {
    console.error(`Unknown box type: ${boxType}`);
    return null; // or render a fallback "unknown box" UI
  }

  // Find connected upstream box names for the settings panel
  const connectedInputs = edges
    .filter((e) => e.target === id)
    .map((e) => {
      const sourceNode = allNodes.find((n) => n.id === e.source);
      return {
        name: (sourceNode?.data?.title as string) || "Unnamed",
        id: e.source,
      };
    });

  // Insert a variable into the prompt at cursor position
  const insertVariable = (varName: string) => {
    const textarea = promptRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentPrompt = boxData.prompt;
    const newPrompt =
      currentPrompt.slice(0, start) +
      "{{" +
      varName +
      "}}" +
      currentPrompt.slice(end);
    updateBoxData(id, { prompt: newPrompt });
    // Restore cursor position after the inserted text
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + varName.length + 4,
        start + varName.length + 4,
      );
    }, 0);
  };

  if (!boxData) return null;

  const isText = boxType === "text";
  const isDocuments = boxType === "documents";
  const isInputBox = isText || isDocuments;
  // Collaboration boxes (note / label / timer / checklist) are standalone
  // annotations: no AI, no Run button, no settings panel, no handles.
  const isNote = boxType === "note";
  const isLabel = boxType === "label";
  const isChecklist = boxType === "checklist";
  const isUtility = isNote || isLabel || isChecklist;

  const isSummary = boxType === "summary";

  // ===== Collaboration annotations render WITHOUT the standard box card =====
  // (no header bar, no border/footer chrome) so they read as canvas
  // annotations, not pipeline boxes. Early returns are safe here: every hook
  // is called above.

  // Note: a post-it paper.
  if (isNote) {
    return (
      <>
        <NodeResizer minWidth={160} minHeight={140} isVisible={!!selected} />
        <div className={"note-node" + (selected ? " selected" : "")}>
          <button
            className="note-delete nodrag"
            onClick={() => deleteBox(id)}
            title="Delete note"
          >
            ✕
          </button>
          <textarea
            className="nodrag nowheel note-textarea"
            placeholder="Write a note for the team…"
            value={boxData.content}
            onChange={(e) => updateBoxData(id, { content: e.target.value })}
          />
          <p className="note-author">
            — {boxData.authorName || "Someone"}
            {boxData.authorEmail ? ` (${boxData.authorEmail})` : ""}
          </p>
        </div>
      </>
    );
  }

  // Label: a floating text chip.
  if (isLabel) {
    return (
      <div className={"label-node" + (selected ? " selected" : "")}>
        <div className="label-row">
          {isEditingLabel ? (
            <input
              autoFocus
              className="nodrag w-44 rounded-full border border-line-control bg-surface px-3 py-1.5 text-center text-[13px] font-bold text-ink shadow-md focus:outline-none focus:ring-2 focus:ring-[rgba(22,24,29,.15)]"
              value={labelDraft}
              placeholder="Label text…"
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={() => {
                if (labelDraft.trim())
                  updateBoxData(id, { content: labelDraft.trim() });
                setIsEditingLabel(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (labelDraft.trim())
                    updateBoxData(id, { content: labelDraft.trim() });
                  setIsEditingLabel(false);
                }
                if (e.key === "Escape") setIsEditingLabel(false);
              }}
            />
          ) : (
            <div
              className={
                "label-pill nodrag cursor-text" +
                (boxData.labelColor === GROUP_LABEL_COLOR ? " is-group" : "")
              }
              style={{ backgroundColor: boxData.labelColor || LABEL_COLORS[0] }}
              onClick={() => {
                setLabelDraft(boxData.content);
                setIsEditingLabel(true);
              }}
              title="Click to edit the label text"
            >
              {boxData.content || (
                <span className="text-slate-400 font-medium">
                  Click to add text…
                </span>
              )}
            </div>
          )}
          <button
            className="label-delete nodrag"
            style={{
              left: "calc(100% + 6px)",
              top: "50%",
              transform: "translateY(-50%)",
            }}
            onClick={() => deleteBox(id)}
            title="Delete label"
          >
            ✕
          </button>
        </div>
        {selected && (
          <div className="nodrag flex gap-1.5">
            {LABEL_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => updateBoxData(id, { labelColor: c })}
                className={
                  "label-color-dot w-4 h-4 rounded-full border transition " +
                  ((boxData.labelColor || LABEL_COLORS[0]) === c
                    ? "border-slate-700 scale-125"
                    : "border-slate-300")
                }
                style={{ backgroundColor: c }}
                title="Set label color"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isRunning = boxData.status === "running";
  const isQueued = boxData.status === "queued";
  // Running or waiting in the queue: the Run controls are unavailable.
  const isBusy = isRunning || isQueued;
  const hasError = boxData.status === "error";
  const hasTextOutput = boxData.output && boxData.output.trim().length > 0;

  // The PDF Summary has no AI run of its own — it updates live from the
  // pipeline outputs — so it gets the shell but no Run / settings / footer.
  const isAIBox = !isInputBox && !isUtility && !isSummary;

  const versionCount = boxData.history?.length ?? 0;
  const currentVersion = boxData.currentVersionId ?? "";
  const historyOpen = historyOpenedAt !== null && historyOpenedAt === currentVersion;

  /** The box's output; with `version`, a read-only earlier version of it. */
  const renderOutput = (content: string, version?: HistoryEntry) =>
    boxType === "insight" ? (
      <InsightWeaverOutput content={content} boxId={id} readOnly={!!version} />
    ) : boxType === "journey" ? (
      <JourneyMapperOutput content={content} />
    ) : boxType === "safety" ? (
      <SafetyReviewerOutput
        content={content}
        boxId={id}
        readOnly={!!version}
        savedApprovals={version?.approvals}
      />
    ) : boxType === "coach" ? (
      <CoachOutput content={content} boxId={id} readOnly={!!version} />
    ) : (
      <div className="markdown-output text-ink-2 text-[13px] px-3.5 py-3">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );

  // Auto-height: a node with no stored height grows to fit its content (up
  // to a cap, then the body scrolls). Resizing it by hand stores a height,
  // which pins it again.
  const selfNode = allNodes.find((n) => n.id === id);
  const autoHeight = !selfNode?.style?.height && !selfNode?.height;
  const step = STEP_STYLE[boxType];
  const title = (data.title as string) || meta.label + " Box";
  const docs = boxData.documents || [];

  // Upstream wiring, for the empty state ("Ready" vs "Waiting") and ports.
  const upstreamIds = edges.filter((e) => e.target === id).map((e) => e.source);
  const hasDownstream = edges.some((e) => e.source === id);
  const sourceHasOutput = (sourceId: string) => {
    const d = allBoxData[sourceId];
    if (!d) return false;
    if (d.output && d.output.trim()) return true;
    if (d.content && d.content.trim()) return true;
    return (d.documents || []).some((doc) => !doc.error && doc.text);
  };
  const waitingOn = upstreamIds.find((u) => !sourceHasOutput(u));
  const isReady = upstreamIds.length > 0 && !waitingOn;
  // While queued, name the upstream box that is still generating.
  const busyUpstream = upstreamIds.find((u) => {
    const status = allBoxData[u]?.status;
    return status === "running" || status === "queued";
  });
  const busyUpstreamTitle = busyUpstream
    ? displayTitle(
        (allNodes.find((n) => n.id === busyUpstream)?.data?.title as string) ||
          "the previous step",
      )
    : "the previous step";
  const waitingOnTitle = waitingOn
    ? displayTitle(
        (allNodes.find((n) => n.id === waitingOn)?.data?.title as string) ||
          "the previous step",
      )
    : null;

  // Review progress for the header pill (Safety decisions; Coach mirrors
  // the Safety decisions on the risks it responds to).
  const upstreamSafetyId = boxType === "coach" ? upstreamIds[0] : undefined;
  const review =
    boxType === "safety"
      ? safetyReviewCounts(boxData.output, boxData.approvals)
      : boxType === "coach"
        ? coachReviewCounts(
            boxData.output,
            upstreamSafetyId ? allBoxData[upstreamSafetyId]?.output : undefined,
            upstreamSafetyId ? allBoxData[upstreamSafetyId]?.approvals : undefined,
          )
        : null;

  const subtitle = isSummary
    ? summarySectionCount > 0
      ? `${summarySectionCount} ${summarySectionCount === 1 ? "section" : "sections"} · updates live`
      : meta.subtitle
    : isAIBox && hasTextOutput
      ? resultSummary(boxType, boxData.output, {
          inputCount: upstreamIds.length,
        }) ?? meta.subtitle
      : meta.subtitle;

  // Header status pill.
  let pill: { cls: string; label: string; icon?: "check" | "spin" } | null = null;
  if (isAIBox) {
    if (isRunning) pill = { cls: "", label: "Running", icon: "spin" };
    else if (isQueued) pill = { cls: "is-waiting", label: "Queued" };
    else if (hasError) pill = { cls: "is-error", label: "Error" };
    else if (hasTextOutput) {
      if (review && review.total > 0 && review.reviewed < review.total)
        pill = { cls: "is-review", label: `${review.total - review.reviewed} to review` };
      else if (review && review.total > 0)
        pill = { cls: "", label: "Reviewed", icon: "check" };
      else pill = { cls: "", label: "Done", icon: "check" };
    } else if (isReady) pill = { cls: "is-ready", label: "Ready" };
    else pill = { cls: "is-waiting", label: "Waiting" };
  } else if (isSummary) {
    pill =
      summarySectionCount > 0
        ? { cls: "", label: "Live", icon: "check" }
        : { cls: "is-waiting", label: "Waiting" };
  }

  // Tile + port colours.
  const identity = step?.color ?? "var(--ink)";
  const tileEmpty = isDocuments && docs.length === 0;
  const portFill = (connected: boolean) =>
    connected && !tileEmpty ? identity : "var(--port-empty)";

  // Participant transcript: drop a leading line that just repeats the box
  // title ("Participant P1") from the excerpt — display only.
  const transcriptExcerpt = (() => {
    const text = boxData.content || "";
    const [first, ...rest] = text.split("\n");
    return first.trim().toLowerCase() === displayTitle(title).trim().toLowerCase()
      ? rest.join("\n").trim()
      : text.trim();
  })();

  const tokens = boxData.tokens;

  // ===== Documents box =====

  /**
   * Processes uploaded/dropped files one at a time: extract text client-side,
   * trim it to the box's remaining budget. Failed extractions become entries with an error message (never
   * thrown away silently).
   */
  const handleDocumentsUpload = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).slice(0, 10); // sane per-batch cap
    setDocBusy((n) => n + list.length);
    for (const file of list) {
      let entry: BoxDocument;
      try {
        const raw = await extractDocumentText(file);
        const budget = remainingDocBudget(
          useBoardStore.getState().boxData[id]?.documents,
        );
        const { text, truncated } = clampDocText(raw, budget);
        entry = {
          id: makeDocId(file.name, file.size),
          name: file.name,
          size: file.size,
          ext: docExt(file.name),
          url: "",
          text,
          chars: text.length,
          truncated,
          error: !raw.trim()
            ? "No extractable text (scanned PDF?) - paste the transcript instead."
            : !text
              ? "This box's document-text budget is used up — remove other files first."
              : "",
        };
      } catch (err: any) {
        entry = {
          id: makeDocId(file.name, file.size),
          name: file.name,
          size: file.size,
          ext: docExt(file.name),
          url: "",
          text: "",
          chars: 0,
          truncated: false,
          error: err?.message || "Could not extract text from this file.",
        };
      }
      const existing = useBoardStore.getState().boxData[id]?.documents || [];
      updateBoxData(id, { documents: [...existing, entry] });
      setDocBusy((n) => Math.max(0, n - 1));
    }
  };

  const removeDocument = (docId: string) => {
    const existing = useBoardStore.getState().boxData[id]?.documents || [];
    updateBoxData(id, { documents: existing.filter((d) => d.id !== docId) });
  };

  return (
    <>
      <NodeResizer
        minWidth={220}
        minHeight={isChecklist ? 200 : 160}
        isVisible={!!selected}
      />
      <div
        className={
          "box-node" +
          (selected ? " selected" : "") +
          (hasError ? " has-error" : "") +
          (autoHeight ? " is-auto" : "")
        }
      >
        {/* Target handle (input) — AI boxes only (not input/utility boxes).
          Ports sit on the header's centre line (see .node-port). */}
        {isAIBox && (
          <Handle
            type="target"
            position={Position.Left}
            className="node-port"
            style={{ background: portFill(upstreamIds.length > 0) }}
          />
        )}

        {/* Header: tile · title / subtitle · status pill · ⋯ menu */}
        <div className="node-header">
          <Tooltip text={BOX_USAGE[boxType]}>
            <span
              className={"node-tile" + (tileEmpty ? " is-empty" : "")}
              style={{ "--tile-color": identity } as React.CSSProperties}
              aria-hidden
            >
              {tileText(boxType, title) ?? <BoxIcon type={boxType} />}
            </span>
          </Tooltip>

          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <input
                autoFocus
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => {
                  setBoxName(id, nameDraft.trim() || meta.label + " Box");
                  setIsEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setBoxName(id, nameDraft.trim() || meta.label + " Box");
                    setIsEditingName(false);
                  }
                  if (e.key === "Escape") setIsEditingName(false);
                }}
                className="nodrag w-full text-[14px] font-semibold leading-tight text-ink bg-surface rounded-md px-1.5 py-0.5 -ml-1.5 border border-line-control focus:outline-none focus:ring-2 focus:ring-[rgba(22,24,29,.15)] min-w-0"
              />
            ) : (
              <div
                onClick={() => {
                  setNameDraft(title);
                  setIsEditingName(true);
                }}
                className="text-[14px] font-semibold leading-[1.25] text-ink truncate cursor-text"
                title="Click to rename"
              >
                {displayTitle(title)}
              </div>
            )}
            {subtitle && (
              <div className="text-[12px] leading-[1.35] text-ink-muted mt-0.5 truncate">
                {subtitle}
              </div>
            )}
          </div>

          {pill && (
            <span className={"status-pill " + pill.cls}>
              {pill.icon === "check" && <CheckIcon />}
              {pill.icon === "spin" && <Spinner size={11} />}
              {pill.label}
            </span>
          )}

          <div className="nodrag">
            <Menu
              panelClassName="w-44"
              trigger={({ open, toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  className={
                    "box-delete w-7 h-7 flex items-center justify-center rounded-md text-ink-icon transition-colors hover:bg-surface-sunken hover:text-ink " +
                    (open ? "bg-surface-sunken text-ink" : "")
                  }
                  title="Box actions"
                  aria-label="Box actions"
                >
                  <MoreIcon />
                </button>
              )}
            >
              {(close) => (
                <div className="py-1">
                  <MenuItem
                    label="Rename"
                    onClick={() => {
                      close();
                      setNameDraft(title);
                      setIsEditingName(true);
                    }}
                  />
                  <MenuItem
                    icon={<TrashIcon />}
                    label="Delete box"
                    danger
                    onClick={() => {
                      close();
                      deleteBox(id);
                    }}
                  />
                </div>
              )}
            </Menu>
          </div>
        </div>

        {isStale && !isInputBox && (
          <div className="flex-none flex items-center justify-between gap-2 px-3.5 py-1.5 text-[12px] bg-[color:var(--amber-bg)] text-[color:var(--amber-text)] border-b border-line-divider">
            <span className="flex items-center gap-1.5 font-medium">
              <AlertIcon /> Input changed since last run
            </span>
            <button
              onClick={() => runBox(id)}
              className="font-semibold hover:underline"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Body. `nodrag` lets a finger scroll long output inside the box on
          touch devices (the box is dragged by its header instead) — paired
          with `touch-action: pan-y` on `.box-body` for coarse pointers. */}
        <div
          className={
            "box-body flex-1 min-h-0 overflow-y-auto flex flex-col " +
            (isChecklist ? "px-3 py-2" : "")
          }
        >
          {/* Checklist box — the team's shared to-do list (collab). Every rule
            lives in lib/checklist.ts; the panel is rendering + store wiring. */}
          {isChecklist && (
            <ChecklistPanel boxId={id} items={boxData.checklistItems} />
          )}

          {/* ===== AI / input boxes ===== */}

          {/* Text context box — a 3-line excerpt by default; the full text
            opens in the (still editable) transcript editor. */}
          {isText && (
            <div className="flex-1 min-h-0 flex flex-col px-3.5 pt-3 pb-3.5 text-[13px] leading-[1.5] text-ink-2">
              {transcriptExpanded || !transcriptExcerpt ? (
                <textarea
                  autoFocus={transcriptExpanded}
                  className="nodrag nowheel w-full flex-1 min-h-[132px] resize-none bg-transparent border-0 p-0 text-[13px] leading-[1.5] text-ink-2 focus:outline-none placeholder:text-ink-icon"
                  placeholder="Write or paste the transcript here..."
                  value={boxData.content}
                  onChange={(e) =>
                    updateBoxData(id, {
                      content: e.target.value,
                      output: e.target.value,
                    })
                  }
                />
              ) : (
                <div
                  className="nodrag cursor-text whitespace-pre-line"
                  style={{
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 3,
                    overflow: "hidden",
                  }}
                  onClick={() => setTranscriptExpanded(true)}
                  title="Show and edit the full transcript"
                >
                  {transcriptExcerpt}
                </div>
              )}
              {transcriptExcerpt && (
                <button
                  type="button"
                  onClick={() => setTranscriptExpanded((v) => !v)}
                  className="nodrag self-start mt-2 font-mono text-[11px] text-ink-muted hover:text-ink transition-colors"
                >
                  {transcriptExpanded ? "Show excerpt" : "Show full text"}
                </button>
              )}
            </div>
          )}

          {/* Documents upload box — multi-file, drag & drop, extracted text
            becomes the box's output for downstream prompt templating. */}
          {isDocuments &&
            (() => {
              const totalChars = docs.reduce((s, d) => s + d.chars, 0);
              const usable = docs.filter((d) => !d.error && d.text).length;
              return (
                <div className="nodrag p-3 flex flex-col gap-2">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDocDragOver(true);
                    }}
                    onDragLeave={() => setDocDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDocDragOver(false);
                      handleDocumentsUpload(e.dataTransfer.files);
                    }}
                    className={
                      "cursor-pointer rounded-[10px] px-3.5 py-3 flex items-center gap-3 transition-colors border-[1.5px] border-dashed " +
                      (docDragOver
                        ? "border-ink-icon bg-surface-muted"
                        : "border-[color:var(--dropzone-border)] bg-[color:var(--dropzone-bg)] hover:bg-surface-muted")
                    }
                  >
                    <span className="w-8 h-8 flex-none rounded-lg bg-surface border border-line-control grid place-items-center text-ink-3">
                      <UploadIcon />
                    </span>
                    <div>
                      <div className="text-[13px] font-semibold text-ink">
                        Click or drop files
                      </div>
                      <div className="font-mono text-[11px] text-ink-muted mt-0.5">
                        PDF, DOCX, TXT
                      </div>
                    </div>
                  </div>

                  {docBusy > 0 && (
                    <div className="flex items-center justify-center gap-2 text-[12px] text-ink-muted bg-surface-sunken rounded-lg py-2">
                      <Spinner />
                      Extracting text from {docBusy} file
                      {docBusy > 1 ? "s" : ""}…
                    </div>
                  )}

                  {docs.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {docs.map((d) => (
                        <div
                          key={d.id}
                          className="group flex items-start gap-2.5 rounded-lg border border-line-soft bg-surface px-2.5 py-2"
                        >
                          <span className="flex-none mt-0.5 text-ink-muted">
                            <FileIcon />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-[13px] font-medium text-ink truncate"
                              title={d.name}
                            >
                              {d.name}
                            </div>
                            <div className="font-mono text-[11px] text-ink-muted">
                              {formatBytes(d.size)}
                              {d.error ? (
                                <span className="text-[color:var(--red-text)]">
                                  {" "}
                                  — {d.error}
                                </span>
                              ) : (
                                <>
                                  {" · "}
                                  {d.chars.toLocaleString()} chars
                                  {d.truncated ? " (truncated)" : ""}
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => removeDocument(d.id)}
                            className="w-6 h-6 rounded-md text-ink-icon hover:text-[color:var(--red-text)] hover:bg-[color:var(--red-bg)] flex items-center justify-center flex-none transition"
                            title="Remove this document"
                          >
                            <CloseIcon />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {docs.length > 0 && (
                    <p className="font-mono text-[11px] text-ink-muted leading-snug px-0.5">
                      {usable} of {docs.length} usable ·{" "}
                      {totalChars.toLocaleString()} chars total — flows into
                      connected boxes via {"{{inputs}}"}.
                    </p>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={SUPPORTED_DOC_EXTS.map((e) => "." + e).join(",")}
                    className="hidden"
                    onChange={(e) => {
                      handleDocumentsUpload(e.target.files);
                      e.target.value = ""; // allow re-uploading the same file
                    }}
                  />
                </div>
              );
            })()}

          {/* AI box output — text (Insight Weaver, Journey Mapper, etc...). Collaboration boxes
            (timer/checklist) never produce an output, so they get neither the
            block nor its "no output yet" placeholder. */}
          {isSummary && <SummaryOutput report={summaryReport} />}

          {isAIBox && (
            <div className="min-h-[80px]">
              {/* Running: what it's doing, over a shimmering placeholder of
                the output to come. */}
              {/* Queued: waiting for an upstream box to finish first. */}
              {isQueued && (
                <div className="px-7 py-8 flex flex-col items-center gap-2 text-center anim-fade-up" role="status">
                  <div className="flex items-center gap-2 text-ink text-[13.5px] font-semibold">
                    <Spinner size={13} />
                    <span>Queued</span>
                  </div>
                  <p className="m-0 max-w-[280px] text-[13px] leading-[1.5] text-ink-3 [text-wrap:pretty]">
                    Will run automatically when {busyUpstreamTitle} finishes generating.
                  </p>
                </div>
              )}
              {isRunning && (
                <div className="px-4 pt-5 pb-6 flex flex-col gap-4 anim-fade-up">
                  <div className="flex items-center gap-2 text-ink-muted text-[13px] justify-center">
                    <Spinner size={13} />
                    <span>{meta.loadingText ?? "Generating..."}</span>
                  </div>
                  <div className="flex flex-col gap-2.5" aria-hidden>
                    {[92, 78, 85, 64].map((w, i) => (
                      <div key={i} className="rounded-[10px] border border-line-soft px-3 py-3 flex flex-col gap-2">
                        <div className="skeleton-line" style={{ width: `${w}%`, animationDelay: `${i * 0.12}s` }} />
                        <div className="skeleton-line !h-2 opacity-70" style={{ width: `${w - 30}%`, animationDelay: `${i * 0.12 + 0.06}s` }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Run failed: same centred layout as the empty state, with a
                red-tinted warning tile, what happened / what's unaffected,
                the technical message in a details panel, and Try again. */}
              {hasError && !isBusy && (
                <div className="px-6 py-7 flex flex-col items-center gap-3 text-center">
                  <span
                    className="node-tile !w-9 !h-9 !rounded-[10px]"
                    style={{ "--tile-color": "var(--red-text)" } as React.CSSProperties}
                    aria-hidden
                  >
                    <AlertIcon size={17} strokeWidth={1.9} />
                  </span>
                  <div className="flex flex-col gap-1">
                    <p className="m-0 text-[14px] font-semibold text-ink">
                      {meta.errorTitle ?? "Something went wrong."}
                    </p>
                    {meta.errorHint && (
                      <p className="m-0 max-w-[300px] text-[13px] leading-[1.5] text-ink-3 [text-wrap:pretty]">
                        {meta.errorHint}
                      </p>
                    )}
                  </div>
                  {boxData.error && (
                    <div className="w-full max-w-[340px] text-left rounded-lg bg-surface-sunken border border-line-soft px-3 py-2">
                      <div className="mono-label mb-1">Details</div>
                      <p
                        className="m-0 font-mono text-[11.5px] leading-[1.5] text-ink-2 [overflow-wrap:anywhere] line-clamp-4"
                        title={boxData.error}
                      >
                        {boxData.error}
                      </p>
                    </div>
                  )}
                  <button onClick={() => runBox(id)} className="nodrag btn btn-primary mt-0.5">
                    <RerunIcon /> Try again
                  </button>
                </div>
              )}

              {/* Output — keyed by version so a new run fades up into
                place — or the version history in its place. */}
              {hasTextOutput && !hasError && !isBusy &&
                (historyOpen ? (
                  <VersionHistory
                    boxType={boxType}
                    data={boxData}
                    renderVersion={(entry) => renderOutput(entry.output, entry)}
                    onRestore={(versionId) => revertToVersion(id, versionId)}
                    onClose={() => setHistoryOpenedAt(null)}
                  />
                ) : (
                  <div key={boxData.currentVersionId ?? "output"} className="anim-fade-up">
                    {renderOutput(boxData.output)}
                  </div>
                ))}

              {/* Empty (not run) state: what the step does, Run, and what
                it's waiting for. Run stays clickable in every state, as
                before — the store reports a missing input as an error. */}
              {!hasTextOutput && !isBusy && !hasError && (
                <div className="px-7 py-8 flex flex-col items-center gap-3.5 text-center">
                  <p className="m-0 max-w-[280px] text-[13.5px] leading-[1.55] text-ink-3 [text-wrap:pretty]">
                    {EMPTY_STATE_COPY[boxType] ?? meta.description}
                  </p>
                  <button
                    onClick={() => runBox(id)}
                    className={"nodrag btn " + (isReady ? "btn-primary" : "btn-secondary")}
                  >
                    <PlayIcon /> Run
                  </button>
                  <span className="font-mono text-[11px] text-ink-muted">
                    {isReady
                      ? `${upstreamIds.length} ${upstreamIds.length === 1 ? "input" : "inputs"} connected`
                      : waitingOnTitle
                        ? `Runs after ${waitingOnTitle}`
                        : "Connect an input to run"}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — AI boxes: token total · history · settings · Rerun */}
        {isAIBox && (
          <div className="node-footer rounded-b-xl">
            {/* Buttons below are nodrag so a click never turns into a drag. */}
            <span
              className="font-mono text-[11.5px] text-ink-muted tabular-nums truncate"
              title={
                tokens
                  ? `Input → output tokens used by this call: ${tokens.promptTokens.toLocaleString()} in · ${tokens.completionTokens.toLocaleString()} out`
                  : undefined
              }
            >
              {hasError
                ? "Last run failed"
                : tokens
                  ? `${tokens.totalTokens.toLocaleString()} tokens`
                  : hasTextOutput
                    ? ""
                    : "Not run yet"}
            </span>
            <div className="flex-1" />
            {!hasError && (
              <>
                <button
                  onClick={() => setHistoryOpenedAt(historyOpen ? null : currentVersion)}
                  disabled={versionCount === 0}
                  aria-pressed={historyOpen}
                  className={
                    "nodrag btn btn-secondary btn-sm btn-icon " + (historyOpen ? "is-active" : "")
                  }
                  title={
                    versionCount
                      ? "Version history: see earlier outputs of this box and restore one"
                      : "Version history: each run adds a version"
                  }
                  aria-label="Version history"
                >
                  <HistoryIcon />
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={
                    "nodrag btn btn-secondary btn-sm btn-icon " + (showSettings ? "is-active" : "")
                  }
                  title="Prompt settings"
                  aria-label="Prompt settings"
                >
                  <SettingsIcon />
                </button>
                {(hasTextOutput || isBusy) && (
                  <button
                    onClick={() => runBox(id)}
                    disabled={isBusy}
                    className="nodrag btn btn-secondary btn-sm"
                  >
                    {isBusy ? <Spinner /> : <RerunIcon />}
                    {isQueued ? "Queued" : "Rerun"}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Settings panel — collapsible (AI boxes only) */}
        {isAIBox && showSettings && (
          <div className="px-3.5 py-3 border-t border-line-divider bg-surface-sunken space-y-2.5 rounded-b-xl">
            {/* System prompt — text AI boxes only */}
            <div>
              <label className="mono-label block mb-1">
                "System Prompt (role / behavior)"
              </label>
              <textarea
                className="w-full text-xs rounded-lg border border-line bg-surface p-2 font-mono text-ink-2 focus:outline-none focus:ring-2 focus:ring-[rgba(22,24,29,.15)] min-h-[60px] resize-y"
                value={boxData.systemPrompt}
                onChange={(e) =>
                  updateBoxData(id, { systemPrompt: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mono-label block mb-1">
                "Prompt Template"
              </label>
              <textarea
                ref={promptRef}
                className="w-full text-xs rounded-lg border border-line bg-surface p-2 font-mono text-ink-2 focus:outline-none focus:ring-2 focus:ring-[rgba(22,24,29,.15)] min-h-[80px] resize-y"
                value={boxData.prompt}
                onChange={(e) => updateBoxData(id, { prompt: e.target.value })}
              />
              <div className="mt-2">
                <p className="text-xs font-medium text-ink-3 mb-1">
                  Available inputs (click to insert):
                </p>
                {connectedInputs.length === 0 ? (
                  <p className="text-xs text-ink-muted">
                    No boxes connected. Connect an input box to reference it by
                    name.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {connectedInputs.map((inp) => (
                      <button
                        key={inp.id}
                        onClick={() => insertVariable(inp.name)}
                        className="text-xs px-2 py-1 rounded-md bg-surface border border-line-control text-ink hover:bg-surface-hover transition font-mono"
                        title={"Insert {{" + inp.name + "}} into prompt"}
                      >
                        {"{{" + inp.name + "}}"}
                      </button>
                    ))}
                    <button
                      onClick={() => insertVariable("inputs")}
                      className="text-xs px-2 py-1 rounded-md bg-surface-muted text-ink-3 hover:bg-line-soft transition font-mono"
                      title="Insert {{inputs}} — all inputs combined"
                    >
                      {"{{inputs}}"}
                    </button>
                  </div>
                )}
                <p className="text-xs text-ink-muted mt-1">
                  Also supports:{" "}
                  <code className="bg-surface-muted px-1 rounded font-mono">
                    {"{{input_1}}"}
                  </code>{" "}
                  (positional)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Source handle (output) — pipeline boxes only; collaboration boxes
          (note/label/timer) are standalone annotations with no handles, and
          the PDF Summary reads the pipeline by type, so it has none either. */}
        {!isUtility && !isSummary && (
          <Handle
            type="source"
            position={Position.Right}
            className="node-port"
            style={{ background: portFill(hasDownstream) }}
          />
        )}
      </div>
    </>
  );
}

export default memo(BoxNode);
