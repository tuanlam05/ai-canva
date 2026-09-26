import type { Edge, Node } from "@xyflow/react";
import { BOX_TYPES } from "../types.js";
import type { BoxData, BoxDocument, BoxType } from "../types.js";

import p1 from "../fixtures/transcripts/participant-p1.txt?raw";
import p2 from "../fixtures/transcripts/participant-p2.txt?raw";
import p3 from "../fixtures/transcripts/participant-p3.txt?raw";
import p4 from "../fixtures/transcripts/participant-p4.txt?raw";

/**
 * The showcase board: four synthetic research transcripts and the pipeline
 * that reads them. Built in code rather than saved to Firestore so the demo
 * can always be restored.
 *
 * The inputs are deliberately NOT wired to Insight Weaver: connecting them is
 * part of the walkthrough. The four AI boxes are wired to each other, since
 * nobody wants to redraw the pipeline between visitors.
 *
 * Box ids are fixed strings so that a reset overwrites the same boxData entries.
 */

/** Transcripts in board order, with the box title used to attribute quotes. */
const TRANSCRIPTS = [
  { id: "demo-p1", title: "Participant P1", text: p1 },
  { id: "demo-p2", title: "Participant P2", text: p2 },
  { id: "demo-p3", title: "Participant P3", text: p3 },
] as const;

/** P4 arrives as an uploaded file instead. */
const DOCUMENT_TRANSCRIPT = {
  id: "demo-p4",
  title: "Participant P4",
  fileName: "Participant P4.txt",
  text: p4,
};

/** The AI pipeline in run order. */
const PIPELINE: { id: string; type: BoxType }[] = [
  { id: "demo-insight", type: "insight" },
  { id: "demo-journey", type: "journey" },
  { id: "demo-safety", type: "safety" },
  { id: "demo-coach", type: "coach" },
];

/**
 * Layout. Spacing is derived from the box sizes in BOX_TYPES plus a gutter,
 * so nothing overlaps on open.
 */
const GUTTER = 60;
const INPUT_X = 0;
const TEXT_STEP_Y = BOX_TYPES.text.defaultHeight + GUTTER;
const INPUT_Y = [0, TEXT_STEP_Y, TEXT_STEP_Y * 2, TEXT_STEP_Y * 3];
const PIPELINE_X = BOX_TYPES.text.defaultWidth + GUTTER * 2;
const PIPELINE_STEP_X = BOX_TYPES.insight.defaultWidth + GUTTER;
const PIPELINE_Y = TEXT_STEP_Y;

function node(id: string, type: BoxType, title: string, x: number, y: number): Node {
  const meta = BOX_TYPES[type];
  return {
    id,
    type,
    position: { x, y },
    data: { boxType: type, title },
    style: { width: meta.defaultWidth, height: meta.defaultHeight },
  };
}

function boxData(type: BoxType, patch: Partial<BoxData> = {}): BoxData {
  const meta = BOX_TYPES[type];
  return {
    content: "",
    prompt: meta.defaultPrompt,
    systemPrompt: meta.defaultSystemPrompt,
    output: "",
    status: "idle",
    ...patch,
  };
}

// A Documents-box entry as `handleDocumentsUpload` would have produced it.
function documentEntry(name: string, text: string): BoxDocument {
  return {
    id: "demo-doc-p4",
    name,
    size: new TextEncoder().encode(text).length,
    ext: "txt",
    url: "",
    text,
    chars: text.length,
    truncated: false,
    error: "",
  };
}

export interface DemoBoard {
  nodes: Node[];
  edges: Edge[];
  boxData: Record<string, BoxData>;
}

/**
 * Builds a fresh copy of the demo board. Returns new objects every call, so
 * the caller can hand them straight to the store without a later edit leaking
 * back into the next reset.
 */
export function buildDemoBoard(): DemoBoard {
  const nodes: Node[] = [];
  const data: Record<string, BoxData> = {};

  TRANSCRIPTS.forEach((t, i) => {
    nodes.push(node(t.id, "text", t.title, INPUT_X, INPUT_Y[i]));
    data[t.id] = boxData("text", { content: t.text, output: t.text });
  });

  const doc = DOCUMENT_TRANSCRIPT;
  nodes.push(node(doc.id, "documents", doc.title, INPUT_X, INPUT_Y[3]));
  data[doc.id] = boxData("documents", {
    documents: [documentEntry(doc.fileName, doc.text)],
  });

  PIPELINE.forEach((box, i) => {
    nodes.push(
      node(
        box.id,
        box.type,
        `${BOX_TYPES[box.type].label} Box`,
        PIPELINE_X + i * PIPELINE_STEP_X,
        PIPELINE_Y,
      ),
    );
    data[box.id] = boxData(box.type);
  });

  const edges: Edge[] = PIPELINE.slice(0, -1).map((box, i) => ({
    id: `demo-edge-${box.id}-${PIPELINE[i + 1].id}`,
    source: box.id,
    target: PIPELINE[i + 1].id,
    animated: true,
  }));

  return { nodes, edges, boxData: data };
}
