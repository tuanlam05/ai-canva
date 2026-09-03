import { memo, useState, useRef } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import ReactMarkdown from "react-markdown";
import { useBoardStore } from "../store/boardStore.js";
import { BOX_TYPES } from "../types.js";
import type { BoxType } from "../types.js";
import { uploadImageToStorage } from "../lib/storage.js";

/**
 * Reads an image File, resizes it to max 1024px, and returns a compressed
 * JPEG data URL. Keeps localStorage and API payloads small.
 */
function resizeImage(file: File, maxSize = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("Could not load image"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function BoxNode({ id, data, selected, type }: NodeProps) {
  const boxType = (data.boxType || type) as BoxType;
  const meta = BOX_TYPES[boxType];
  const boxData = useBoardStore((s) => s.boxData[id]);
  const updateBoxData = useBoardStore((s) => s.updateBoxData);
  const deleteBox = useBoardStore((s) => s.deleteBox);
  const runBox = useBoardStore((s) => s.runBox);
  const edges = useBoardStore((s) => s.edges);
  const allNodes = useBoardStore((s) => s.nodes);
  const setBoxName = useBoardStore((s) => s.setBoxName);

  const [showSettings, setShowSettings] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
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
  const isFile = boxType === "file";
  const isInputBox = isText || isFile;

  const isRunning = boxData.status === "running";
  const hasError = boxData.status === "error";
  const hasTextOutput = boxData.output && boxData.output.trim().length > 0;
  const hasUploadedImage = boxData.imageData && boxData.imageData.length > 0;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file);
      // Upload to Firebase Storage so other users can see it via Firestore sync
      const boardId = useBoardStore.getState().currentBoardId;
      if (boardId) {
        const imageUrl = await uploadImageToStorage(boardId, id, dataUrl);
        updateBoxData(id, { imageData: imageUrl });
      } else {
        // Fallback: store base64 locally (no board loaded)
        updateBoxData(id, { imageData: dataUrl });
      }
    } catch (err) {
      console.error("Image upload failed:", err);
    }
  };

  return (
    <>
      <NodeResizer minWidth={220} minHeight={160} isVisible={!!selected} />
      <div
        className={"box-node" + (selected ? " selected" : "")}
        style={{ borderColor: meta.color }}
      >
        {/* Target handle (input) — AI boxes only */}
        {!isInputBox && (
          <Handle
            type="target"
            position={Position.Left}
            style={{ background: meta.color, width: 10, height: 10 }}
          />
        )}

        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 rounded-t-[10px]"
          style={{ backgroundColor: meta.color + "20" }}
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
            <span className="text-xs text-slate-400 flex-shrink-0">
              {meta.label}
            </span>
          </div>
          <button
            onClick={() => deleteBox(id)}
            className="text-slate-400 hover:text-red-500 transition text-sm w-5 h-5 flex items-center justify-center rounded hover:bg-red-50"
            title="Delete box"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-3 py-2 flex-1 min-h-0 overflow-y-auto">
          {/* Text context box — editable textarea */}
          {isText && (
            <textarea
              className="w-full min-h-[100px] resize-y rounded-lg border border-slate-200 p-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
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

          {/* File upload box */}
          {isFile && (
            <div>
              {hasUploadedImage ? (
                <div>
                  <img
                    src={boxData.imageData}
                    alt="Uploaded"
                    className="w-full rounded-lg border border-slate-200"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 w-full text-xs py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
                  >
                    📁 Change Image
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-emerald-400 hover:bg-emerald-50 transition"
                >
                  <div className="text-3xl mb-2">🖼️</div>
                  <div className="text-sm text-slate-500 font-medium">
                    Click to upload
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    PNG, JPG, WebP — max 1024px
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
          )}

          {/* AI box output — text (research, summarize) */}
          {!isInputBox && (
            <div className="min-h-[80px]">
              {isRunning && (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-4 justify-center">
                  <span className="animate-spin">⏳</span>
                  <span>Generating...</span>
                </div>
              )}
              {hasError && !isRunning && (
                <div className="text-red-500 text-sm p-2 bg-red-50 rounded-lg">
                  ⚠️ {boxData.error}
                </div>
              )}
              {hasTextOutput && !isRunning && (
                <div className="markdown-output text-slate-700 text-sm">
                  <ReactMarkdown>{boxData.output}</ReactMarkdown>
                </div>
              )}
              {!hasTextOutput && !isRunning && !hasError && (
                <div className="text-slate-400 text-sm py-4 text-center">
                  No output yet. Click <strong>Run</strong> to generate.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — AI boxes only */}
        {!isInputBox && (
          <div className="px-3 py-2 border-t border-slate-100 flex items-center gap-2">
            <button
              onClick={() => runBox(id)}
              disabled={isRunning}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white transition disabled:opacity-50"
              style={{ backgroundColor: meta.color }}
            >
              {isRunning ? "⏳ Running..." : "▶ Run"}
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

        {/* Settings panel — collapsible */}
        {!isInputBox && showSettings && (
          <div className="px-3 py-3 border-t border-slate-100 bg-slate-50 space-y-2">
            {/* System prompt */}
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                System Prompt (role / behavior)
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
                Prompt Template
              </label>
              <textarea
                ref={promptRef}
                className={
                  "w-full text-xs rounded-lg border border-slate-200 p-2 font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 min-h-[80px] resize-y"
                }
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

        {/* Source handle (output) — all boxes */}
        <Handle
          type="source"
          position={Position.Right}
          style={{ background: meta.color, width: 10, height: 10 }}
        />
      </div>
    </>
  );
}

export default memo(BoxNode);
