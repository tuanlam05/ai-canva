import { memo, useState, useRef } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import { useBoardStore } from "../store/boardStore.js";
import { BOX_TYPES, LABEL_COLORS } from "../types.js";
import type { BoxType } from "../types.js";
import ChecklistPanel from "./ChecklistPanel.js";
import {
  SUPPORTED_DOC_EXTS,
  clampDocText,
  docExt,
  documentIcon,
  extractDocumentText,
  formatBytes,
  makeDocId,
  remainingDocBudget,
} from "../lib/documents.js";
import type { BoxDocument } from "../types.js";
import InsightWeaverOutput from "./outputs/InsightOutput.js";
import JourneyMapperOutput from "./outputs/JourneyOutput.js";

function BoxNode({ id, data, selected, type }: NodeProps) {
  const boxType = (data.boxType || type) as BoxType;
  // Custom boxes: the base meta is a fallback — instances carry their own
  // icon/color/label copied from the user's saved definition (node.data).
  const baseMeta = BOX_TYPES[boxType];
  const meta =
    boxType === "custom"
      ? {
          ...baseMeta,
          icon: (data.customIcon as string) || baseMeta.icon,
          color: (data.customColor as string) || baseMeta.color,
          label: (data.customLabel as string) || baseMeta.label,
        }
      : baseMeta;
  const boxData = useBoardStore((s) => s.boxData[id]);
  const updateBoxData = useBoardStore((s) => s.updateBoxData);
  const deleteBox = useBoardStore((s) => s.deleteBox);
  const runBox = useBoardStore((s) => s.runBox);
  const edges = useBoardStore((s) => s.edges);
  const allNodes = useBoardStore((s) => s.nodes);
  const setBoxName = useBoardStore((s) => s.setBoxName);

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
              className="nodrag w-44 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-center text-[13px] font-bold text-slate-700 shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300"
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
              className="label-pill nodrag cursor-text"
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
  const hasError = boxData.status === "error";
  const hasTextOutput = boxData.output && boxData.output.trim().length > 0;

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
        className={"box-node" + (selected ? " selected" : "")}
        style={{ borderColor: hasError ? "#A71616" : meta.color }}
      >
        {/* Target handle (input) — AI boxes only (not input/utility boxes) */}
        {!isInputBox && !isUtility && (
          <Handle
            type="target"
            position={Position.Left}
            style={{ background: meta.color, width: 10, height: 10 }}
          />
        )}

        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 rounded-t-[10px] gap-1"
          style={{
            backgroundColor: meta.color + "20",
            borderBottom: `1px solid ${hasError ? "#A71616" : meta.color}`,
          }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-base flex-shrink-0">{meta.icon}</span>
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
                className="font-semibold text-slate-700 text-sm bg-white rounded px-1 py-0.5 border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400 flex-1 min-w-0"
              />
            ) : (
              <span
                onClick={() => {
                  setNameDraft((data.title as string) || meta.label + " Box");
                  setIsEditingName(true);
                }}
                className="font-semibold text-slate-700 text-sm truncate cursor-text hover:bg-white/40 rounded px-1 py-0.5 transition"
                title="Click to rename"
              >
                {(data.title as string) || meta.label + " Box"}
              </span>
            )}
            <span className="text-xs text-slate-400 flex-shrink-0 ml-auto">
              {meta.label}
            </span>
          </div>
          <button
            onClick={() => deleteBox(id)}
            className="box-delete nodrag text-slate-400 hover:text-red-500 transition text-sm w-5 h-5 flex items-center justify-center rounded hover:bg-red-50"
            title="Delete box"
          >
            ✕
          </button>
        </div>

        {/* Body. `nodrag` lets a finger scroll long output inside the box on
          touch devices (the box is dragged by its header instead) — paired
          with `touch-action: pan-y` on `.box-body` for coarse pointers. */}
        <div className="box-body nodrag px-3 py-2 flex-1 min-h-0 overflow-y-auto">
          {/* Checklist box — the team's shared to-do list (collab). Every rule
            lives in lib/checklist.ts; the panel is rendering + store wiring. */}
          {isChecklist && (
            <ChecklistPanel boxId={id} items={boxData.checklistItems} />
          )}

          {/* ===== AI / input boxes ===== */}

          {/* Text context box — editable textarea */}
          {isText && (
            <textarea
              className="nodrag nowheel w-full min-h-[100px] resize-none h-full rounded-lg border border-slate-200 p-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
              placeholder="Write your idea here..."
              value={boxData.content}
              onChange={(e) =>
                updateBoxData(id, {
                  content: e.target.value,
                  output: e.target.value,
                })
              }
            />
          )}

          {/* Documents upload box — multi-file, drag & drop, extracted text
            becomes the box's output for downstream prompt templating. */}
          {isDocuments &&
            (() => {
              const docs = boxData.documents || [];
              const totalChars = docs.reduce((s, d) => s + d.chars, 0);
              const usable = docs.filter((d) => !d.error && d.text).length;
              return (
                <div className="nodrag space-y-2">
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
                      "cursor-pointer border-2 border-dashed rounded-lg p-4 text-center transition " +
                      (docDragOver
                        ? "border-slate-500 bg-slate-100"
                        : "border-slate-300 hover:border-slate-400 hover:bg-slate-50")
                    }
                  >
                    <div className="text-2xl mb-1">📎</div>
                    <div className="text-sm text-slate-500 font-medium">
                      Click or drop files
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      PDF, DOCX, TXT
                    </div>
                  </div>

                  {docBusy > 0 && (
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg py-2">
                      <span className="animate-spin inline-block">⏳</span>
                      Extracting text from {docBusy} file
                      {docBusy > 1 ? "s" : ""}…
                    </div>
                  )}

                  {docs.length > 0 && (
                    <div className="space-y-1.5">
                      {docs.map((d) => (
                        <div
                          key={d.id}
                          className="group flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                        >
                          <span className="text-sm flex-shrink-0 mt-0.5">
                            {documentIcon(d.ext)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-[13px] font-medium text-slate-700 truncate"
                              title={d.name}
                            >
                              {d.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {formatBytes(d.size)}
                              {d.error ? (
                                <span className="text-red-500">
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
                            className="touch-visible w-5 h-5 rounded-full text-[10px] text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition"
                            title="Remove this document"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {docs.length > 0 && (
                    <p className="text-[11px] text-slate-400 leading-snug px-0.5">
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
          {!isInputBox && !isUtility && (
            <div className="min-h-[80px]">
              {isRunning && (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-4 justify-center">
                  <span className="animate-spin">⏳</span>
                  <span>{meta.loadingText ?? "Generating..."}</span>
                </div>
              )}
              {hasError && !isRunning && (
                <div>
                  <p className="text-[15px] font-inter text-[#892121]">
                    {meta.errorTitle ?? "Something went wrong."}
                  </p>
                  <p className="text-[11px] font-inter text-[#B3B9C6]">{meta.errorHint}</p>
                  <p
                    className="text-[11px] text-slate-400 font-mono"
                    title={boxData.error}
                  >
                    Error: {boxData.error}
                  </p>
                  <button
                    onClick={() => runBox(id)}
                    className="text-[11px] mt-2 border border-[#E4E4E4] rounded-md px-5 py-1 hover:bg-slate-100 text-[#575758] font-inter transition"
                  >
                    Try again
                  </button>
                </div>
              )}

              {hasTextOutput && !hasError &&
                !isRunning &&
                (boxType === "insight" ? (
                  <InsightWeaverOutput content={boxData.output} />
                ) : boxType === "journey" ? (
                  <JourneyMapperOutput content={boxData.output} />
                ) : (
                  <div className="markdown-output text-slate-700 text-sm">
                    <ReactMarkdown>{boxData.output}</ReactMarkdown>
                  </div>
                ))}
              {!hasTextOutput && !isRunning && !hasError && !isUtility && (
                <div className="text-slate-400 text-sm py-4 text-center">
                  <>
                    No output yet. Click <strong>Run</strong> to generate.
                  </>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Token usage from the last LLM call */}
        {boxData.tokens && (
          <div className="px-3 py-1.5 border-t border-slate-100 flex items-center justify-end gap-2 text-[10px] text-slate-400">
            <span title="Input → output tokens used by this call">
              ⚡{" "}
              <span className="tabular-nums">
                {boxData.tokens.promptTokens} in ·{" "}
                {boxData.tokens.completionTokens} out
              </span>
            </span>
            <span className="font-semibold text-slate-500 tabular-nums">
              {boxData.tokens.totalTokens} tok
            </span>
          </div>
        )}

        {/* Footer — AI boxes only */}
        {!isInputBox && !isUtility && !hasError && (
          <div className="box-footer px-3 py-2 border-t border-slate-100 flex items-center gap-2">
            <button
              onClick={() => runBox(id)}
              disabled={isRunning}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition disabled:opacity-50"
              style={{ backgroundColor: meta.color }}
            >
              ▶ Run
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={
                "px-2.5 py-1.5 rounded-lg text-sm transition " +
                (showSettings
                  ? "bg-slate-200 text-slate-700"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200")
              }
              title="Prompt settings"
            >
              ⚙
            </button>
          </div>
        )}

        {/* Settings panel — collapsible (AI boxes only) */}
        {!isInputBox && !isUtility && showSettings && (
          <div className="px-3 py-3 border-t border-slate-100 bg-slate-50 space-y-2">
            {/* System prompt — text AI boxes only */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                "System Prompt (role / behavior)"
              </label>
              <textarea
                className="w-full text-xs rounded-lg border border-slate-200 p-2 font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 min-h-[60px] resize-y"
                value={boxData.systemPrompt}
                onChange={(e) =>
                  updateBoxData(id, { systemPrompt: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                "Prompt Template"
              </label>
              <textarea
                ref={promptRef}
                className="w-full text-xs rounded-lg border border-slate-200 p-2 font-mono text-slate-700 focus:outline-none focus:ring-2 min-h-[80px] resize-y"
                value={boxData.prompt}
                onChange={(e) => updateBoxData(id, { prompt: e.target.value })}
              />
              <div className="mt-2">
                <p className="text-xs font-medium text-slate-500 mb-1">
                  Available inputs (click to insert):
                </p>
                {connectedInputs.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No boxes connected. Connect an input box to reference it by
                    name.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {connectedInputs.map((inp) => (
                      <button
                        key={inp.id}
                        onClick={() => insertVariable(inp.name)}
                        className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition font-mono"
                        title={"Insert {{" + inp.name + "}} into prompt"}
                      >
                        {"{{" + inp.name + "}}"}
                      </button>
                    ))}
                    <button
                      onClick={() => insertVariable("inputs")}
                      className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 transition font-mono"
                      title="Insert {{inputs}} — all inputs combined"
                    >
                      {"{{inputs}}"}
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-1">
                  Also supports:{" "}
                  <code className="bg-slate-200 px-1 rounded">
                    {"{{input_1}}"}
                  </code>{" "}
                  (positional)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Source handle (output) — pipeline boxes only; collaboration boxes
          (note/label/timer) are standalone annotations with no handles. */}
        {!isUtility && (
          <Handle
            type="source"
            position={Position.Right}
            style={{ background: meta.color, width: 10, height: 10 }}
          />
        )}
      </div>
    </>
  );
}

export default memo(BoxNode);
