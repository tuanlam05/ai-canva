import type { Edge, Node } from "@xyflow/react";
import { BOX_TYPES } from "../types.js";
import type { BoxData, BoxDocument, BoxType } from "../types.js";
import { NEUTRAL_AREA } from "./areas.js";

import p1 from "../fixtures/transcripts/participant-p1.txt?raw";
import p2 from "../fixtures/transcripts/participant-p2.txt?raw";
import p3 from "../fixtures/transcripts/participant-p3.txt?raw";
import p4 from "../fixtures/transcripts/participant-p4.txt?raw";

/**
 * The showcase board: four synthetic research transcripts and the pipeline
 * that reads them. Built in code rather than saved to Firestore so the demo
 * can always be restored.
 *
 * The flow reads left to right in three numbered groups: 1 Research inputs
 * (P1–P4, not connected: you choose which transcripts feed Theme Finder),
 * 2 the AI research pipeline, 3 the research summary. The pipeline row is
 * centred on the input stack so connectors from the inputs fan in evenly.
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
 * Layout (research-canvas restyle): two group frames side by side whose
 * header rows line up, so every node header sits on the same y and the
 * AI → AI connectors run straight. Sizes follow the design reference.
 */
const GROUP_HEADER = 46;
/** Room between the groups for the connectors to curve. */
const GROUP_GAP = 120;
const INPUT_GROUP_PAD = 16;
const PIPELINE_GROUP_PAD = 20;

const INPUT_GROUP_X = 0;
const INPUT_GROUP_Y = 0;
const INPUT_WIDTH = 288;
const INPUT_GAP = 12;
/** Participant nodes are auto-height; these are their collapsed heights. */
const TEXT_HEIGHT = 170;
const DOCUMENTS_HEIGHT = 246;
const INPUT_X = INPUT_GROUP_X + INPUT_GROUP_PAD;
const INPUT_Y = [0, 1, 2, 3].map(
  (i) => INPUT_GROUP_Y + GROUP_HEADER + i * (TEXT_HEIGHT + INPUT_GAP),
);

const PIPELINE_GROUP_X = INPUT_GROUP_X + INPUT_WIDTH + INPUT_GROUP_PAD * 2 + GROUP_GAP;
/** Pipeline headers line up with the middle of the input stack (between the
 *  P1 and P4 headers), so the P1–P4 → Theme Finder connectors fan in evenly. */
const PIPELINE_Y = Math.round((INPUT_Y[0] + INPUT_Y[3]) / 2);
const PIPELINE_GROUP_Y = PIPELINE_Y - GROUP_HEADER;
const PIPELINE_X = PIPELINE_GROUP_X + PIPELINE_GROUP_PAD;
const PIPELINE_STEP_GAP = 72;
/** Pipeline nodes are auto-height (capped at 860px by .box-node.is-auto);
 *  the frame is sized for the cap so a fully grown box still fits. */
const PIPELINE_HEIGHT = 860;
/** Node widths per step, from the design reference. */
const PIPELINE_WIDTH: Partial<Record<BoxType, number>> = {
  insight: 440,
  journey: 720,
  safety: 460,
  coach: 460,
};

function node(
  id: string,
  type: BoxType,
  title: string,
  x: number,
  y: number,
  size?: { width: number; height?: number },
): Node {
  const meta = BOX_TYPES[type];
  return {
    id,
    type,
    position: { x, y },
    data: { boxType: type, title },
    style: size
      ? size.height
        ? { width: size.width, height: size.height }
        : { width: size.width }
      : { width: meta.defaultWidth, height: meta.defaultHeight },
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

const INPUT_GROUP_WIDTH = INPUT_WIDTH + INPUT_GROUP_PAD * 2;
const INPUT_GROUP_HEIGHT =
  INPUT_Y[3] - INPUT_GROUP_Y + DOCUMENTS_HEIGHT + INPUT_GROUP_PAD;

const PIPELINE_GROUP_WIDTH =
  PIPELINE.reduce((w, box) => w + (PIPELINE_WIDTH[box.type] ?? 400), 0) +
  PIPELINE_STEP_GAP * (PIPELINE.length - 1) +
  PIPELINE_GROUP_PAD * 2;
const PIPELINE_GROUP_HEIGHT = GROUP_HEADER + PIPELINE_HEIGHT + PIPELINE_GROUP_PAD;

/** The summary document closes the pipeline in its own frame, header aligned. */
const SUMMARY_WIDTH = 560;
const SUMMARY_AREA_WIDTH = SUMMARY_WIDTH + PIPELINE_GROUP_PAD * 2;
const SUMMARY_AREA_HEIGHT = PIPELINE_GROUP_HEIGHT;
const SUMMARY_AREA_X = PIPELINE_GROUP_X + PIPELINE_GROUP_WIDTH + GROUP_GAP;
const SUMMARY_AREA_Y = PIPELINE_GROUP_Y;

/**
 * Bumped whenever the demo layout changes. Every demo node carries it, so a
 * browser holding an older copy of the demo (guest mode, see App.tsx) is
 * switched to the current one.
 */
export const DEMO_VERSION = 7;

/** Neutral group-frame fill/border (design tokens group-fill / group-border). */
const GROUP_FRAME = { fill: NEUTRAL_AREA.fill, border: NEUTRAL_AREA.border };

/**
 * Builds a fresh copy of the demo board. Returns new objects every call, so
 * the caller can hand them straight to the store without a later edit leaking
 * back into the next reset.
 */
export function buildDemoBoard(): DemoBoard {
  const nodes: Node[] = [];
  const data: Record<string, BoxData> = {};

  // Outer group frames are fixed visual containers: `fit` makes Canvas size
  // and place them around their boxes (see fitGroupFrames), and they can't
  // be selected, dragged or resized — dragging on one pans the canvas. The
  // caption is drawn by AreaNode in the frame's 46px header row.
  function groupFrame(
    id: string,
    caption: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fit: { ids: string[]; pad: number },
  ): void {
    nodes.push({
      id,
      type: "area",
      position: { x, y },
      style: { width, height },
      zIndex: -1,
      data: { ...GROUP_FRAME, caption, fit: { ...fit, header: GROUP_HEADER } },
    });
  }

  groupFrame(
    "demo-input-area",
    "1 · Research inputs",
    INPUT_GROUP_X,
    INPUT_GROUP_Y,
    INPUT_GROUP_WIDTH,
    INPUT_GROUP_HEIGHT,
    { ids: [...TRANSCRIPTS.map((t) => t.id), DOCUMENT_TRANSCRIPT.id], pad: INPUT_GROUP_PAD },
  );
  groupFrame(
    "demo-pipeline-area",
    "2 · AI research pipeline",
    PIPELINE_GROUP_X,
    PIPELINE_GROUP_Y,
    PIPELINE_GROUP_WIDTH,
    PIPELINE_GROUP_HEIGHT,
    { ids: PIPELINE.map((b) => b.id), pad: PIPELINE_GROUP_PAD },
  );
  groupFrame(
    "demo-summary-area",
    "3 · Research summary",
    SUMMARY_AREA_X,
    SUMMARY_AREA_Y,
    SUMMARY_AREA_WIDTH,
    SUMMARY_AREA_HEIGHT,
    { ids: ["demo-summary"], pad: PIPELINE_GROUP_PAD },
  );

  TRANSCRIPTS.forEach((t, i) => {
    nodes.push(
      node(t.id, "text", t.title, INPUT_X, INPUT_Y[i], { width: INPUT_WIDTH }),
    );
    data[t.id] = boxData("text", { content: t.text, output: t.text });
  });

  const doc = DOCUMENT_TRANSCRIPT;
  nodes.push(
    node(doc.id, "documents", doc.title, INPUT_X, INPUT_Y[3], {
      width: INPUT_WIDTH,
    }),
  );
  data[doc.id] = boxData("documents", {
    documents: [documentEntry(doc.fileName, doc.text)],
  });

  let pipelineX = PIPELINE_X;
  PIPELINE.forEach((box) => {
    const width = PIPELINE_WIDTH[box.type] ?? BOX_TYPES[box.type].defaultWidth;
    nodes.push(
      node(
        box.id,
        box.type,
        `${BOX_TYPES[box.type].label} Box`,
        pipelineX,
        PIPELINE_Y,
        { width },
      ),
    );
    data[box.id] = boxData(box.type);
    pipelineX += width + PIPELINE_STEP_GAP;
  });

  // The pipeline steps are wired in order. The transcripts are left
  // unconnected, so you pick which ones feed Theme Finder.
  const edges: Edge[] = PIPELINE.slice(0, -1).map((box, i) => ({
    id: `demo-edge-${box.id}-${PIPELINE[i + 1].id}`,
    source: box.id,
    target: PIPELINE[i + 1].id,
    animated: true,
  }));

  // The summary reads every pipeline box by type, so it stands alone —
  // no connectors to or from it.
  nodes.push(
    node(
      "demo-summary",
      "summary",
      `${BOX_TYPES.summary.label} Box`,
      SUMMARY_AREA_X + PIPELINE_GROUP_PAD,
      PIPELINE_Y,
      { width: SUMMARY_WIDTH },
    ),
  );
  data["demo-summary"] = boxData("summary");

  for (const n of nodes) n.data = { ...n.data, demoVersion: DEMO_VERSION };

  return { nodes, edges, boxData: data };
}
