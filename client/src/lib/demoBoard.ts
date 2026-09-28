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

function node(
  id: string,
  type: BoxType,
  title: string,
  x: number,
  y: number,
): Node {
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

const AREA_PADDING = 30;
const AREA_HEADER = 50;
const AREA_GAP = 80;

const INPUT_AREA_X = INPUT_X - AREA_PADDING;
const INPUT_AREA_Y = INPUT_Y[0] - AREA_HEADER;

const INPUT_AREA_WIDTH = BOX_TYPES.text.defaultWidth + AREA_PADDING * 2;

const INPUT_AREA_HEIGHT =
  INPUT_Y[3] -
  INPUT_Y[0] +
  BOX_TYPES.text.defaultHeight +
  AREA_HEADER +
  AREA_PADDING;

const PIPELINE_AREA_X = INPUT_AREA_X + INPUT_AREA_WIDTH + AREA_GAP;

const PIPELINE_AREA_Y = PIPELINE_Y - AREA_HEADER;

const PIPELINE_AREA_WIDTH =
  PIPELINE_STEP_X * (PIPELINE.length - 1) +
  BOX_TYPES.insight.defaultWidth +
  AREA_PADDING * 2;

const PIPELINE_AREA_HEIGHT =
  BOX_TYPES.insight.defaultHeight + AREA_HEADER + AREA_PADDING;

const SUMMARY_AREA_WIDTH = 1200;
const SUMMARY_AREA_HEIGHT = 900;

const SUMMARY_AREA_X = PIPELINE_AREA_X + PIPELINE_AREA_WIDTH + 80;

const SUMMARY_AREA_Y = PIPELINE_AREA_Y;

/**
 * Builds a fresh copy of the demo board. Returns new objects every call, so
 * the caller can hand them straight to the store without a later edit leaking
 * back into the next reset.
 */
export function buildDemoBoard(): DemoBoard {
  const nodes: Node[] = [];
  const data: Record<string, BoxData> = {};

  function labelNode(
    id: string,
    text: string,
    x: number,
    y: number,
    color: string,
  ): void {
    nodes.push({
      id,
      type: "label",
      position: { x, y },
      data: {
        boxType: "label",
        title: text,
      },
    });

    data[id] = boxData("label", {
      content: text,
      labelColor: color,
    });
  }

  nodes.push({
    id: "demo-input-area",
    type: "area",
    position: {
      x: INPUT_AREA_X,
      y: INPUT_AREA_Y,
    },
    style: {
      width: INPUT_AREA_WIDTH,
      height: INPUT_AREA_HEIGHT,
    },
    zIndex: -1,
    data: {
      fill: "#f8fafc",
      border: "#cbd5e1",
    },
  });

  nodes.push({
    id: "demo-pipeline-area",
    type: "area",
    position: {
      x: PIPELINE_AREA_X,
      y: PIPELINE_AREA_Y,
    },
    style: {
      width: PIPELINE_AREA_WIDTH,
      height: PIPELINE_AREA_HEIGHT,
    },
    zIndex: -1,
    data: {
      fill: "#f5f3ff",
      border: "#a78bfa",
    },
  });

  labelNode(
    "demo-input-label",
    "Research Inputs",
    INPUT_AREA_X + 20,
    INPUT_AREA_Y + 12,
    "#93c5fd",
  );

  labelNode(
    "demo-pipeline-label",
    "AI Research Pipeline",
    PIPELINE_AREA_X + 20,
    PIPELINE_AREA_Y + 12,
    "#c4b5fd",
  );

  nodes.push({
    id: "demo-summary-area",
    type: "area",
    position: {
      x: SUMMARY_AREA_X,
      y: SUMMARY_AREA_Y,
    },
    style: {
      width: SUMMARY_AREA_WIDTH,
      height: SUMMARY_AREA_HEIGHT,
    },
    zIndex: -1,
    data: {
      fill: "#fffbeb",
      border: "#f59e0b",
    },
  });

  labelNode(
    "demo-summary-label",
    "Research Summary",
    SUMMARY_AREA_X + 20,
    SUMMARY_AREA_Y + 12,
    "#f59e0b",
  );

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

  nodes.push(
    node(
      "demo-summary",
      "summary",
      `${BOX_TYPES.summary.label} Box`,
      SUMMARY_AREA_X + 40,
      SUMMARY_AREA_Y + 60,
    ),
  );

  data["demo-summary"] = boxData("summary");

  return { nodes, edges, boxData: data };
}
