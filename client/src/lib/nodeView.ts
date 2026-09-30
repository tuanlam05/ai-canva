import type { BoxType, ItemApproval } from "../types.js";

/**
 * Presentation helpers for the canvas nodes: step identity, header tile,
 * display title and the header's result summary. Pure functions only — they
 * read box outputs, they never change them.
 */

/**
 * Step identity: an icon tile (see BoxIcon in components/ui/icons.tsx) plus
 * one colour for tile, ports and data marks.
 */
export const STEP_STYLE: Partial<Record<BoxType, { color: string; ink?: boolean }>> = {
  insight: { color: "var(--step-insight)" },
  journey: { color: "var(--step-journey)" },
  safety: { color: "var(--step-safety)" },
  coach: { color: "var(--step-coach)" },
  // The summary document closes the pipeline; it has no data marks of its
  // own, so it stays neutral (ink tile) rather than taking a fifth colour.
  summary: { color: "var(--ink)", ink: true },
};

/** Minimap / static colours (hex fallbacks of the tokens above). */
export const STEP_HEX: Partial<Record<BoxType, string>> = {
  insight: "#2B63AE",
  journey: "#6448B8",
  safety: "#1C7373",
  coach: "#2F7A45",
  text: "#16181D",
  documents: "#16181D",
  summary: "#16181D",
};

/** Copy shown in the empty (not run) body of each AI step. */
export const EMPTY_STATE_COPY: Partial<Record<BoxType, string>> = {
  insight:
    "Reads the connected transcripts and groups what participants said into recurring themes.",
  journey:
    "Maps the themes onto journey stages, showing how people felt at each one and where they struggled.",
  safety:
    "Checks each journey stage for patient-safety risks and lists them for someone to approve or dismiss.",
  coach: "Turns each approved safety flag into concrete design recommendations.",
};

/**
 * Earlier default box names → current ones. Boards saved before the rename
 * still store the old titles (they double as `{{Name}}` prompt variables),
 * so they are only renamed for display.
 */
const RENAMED_BOXES: Record<string, string> = {
  "insight weaver": "Theme Finder",
  "journey mapper": "Journey Flow",
  "patient safety reviewer": "Safety Risk Review",
  "ux coach": "UX Recommendations",
};

/**
 * The name shown in the header. Stored titles keep their " Box" suffix —
 * they double as `{{Name}}` prompt variables and quote sources — so the
 * suffix is only dropped for display, and old default names show as the
 * current ones.
 */
export function displayTitle(title: string): string {
  const name = title.replace(/\s+Box$/i, "") || title;
  return RENAMED_BOXES[name.trim().toLowerCase()] ?? name;
}

/**
 * Header tile text for participant inputs ("Participant P3" → "P3"). Returns
 * null for every other box, which shows its type icon instead.
 */
export function tileText(boxType: BoxType, title: string): string | null {
  if (boxType !== "text" && boxType !== "documents") return null;
  const participant = title.match(/\bP\d+\b/i);
  return participant ? participant[0].toUpperCase() : null;
}

/** Short participant code from an evidence source ("Participant P3" → "P3"). */
export function sourceCode(source: string): string {
  const m = source?.match(/\bP\d+\b/i);
  return m ? m[0].toUpperCase() : source || "—";
}

export function plural(n: number, one: string, many = one + "s"): string {
  return `${n} ${n === 1 ? one : many}`;
}

function parse(output: string | undefined): any {
  if (!output || !output.trim()) return null;
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

/**
 * Header subtitle after a run ("5 themes · from 3 transcripts"). Returns
 * null when the output can't be summarised, so the caller falls back to the
 * step's description.
 */
export function resultSummary(
  boxType: BoxType,
  output: string | undefined,
  opts: { inputCount?: number } = {},
): string | null {
  const parsed = parse(output);
  if (!parsed) return null;
  switch (boxType) {
    case "insight": {
      if (!Array.isArray(parsed.themes)) return null;
      const base = plural(parsed.themes.length, "theme");
      return opts.inputCount
        ? `${base} · from ${plural(opts.inputCount, "transcript")}`
        : base;
    }
    case "journey": {
      if (!Array.isArray(parsed.stages)) return null;
      const friction = parsed.stages.filter(stageHasFriction).length;
      return `${plural(parsed.stages.length, "stage")} · friction in ${friction}`;
    }
    case "safety": {
      if (!Array.isArray(parsed.risks)) return null;
      const clear = Array.isArray(parsed.clear_stages) ? parsed.clear_stages.length : 0;
      return `${plural(parsed.risks.length, "flag")} · ${plural(clear, "stage")} clear`;
    }
    case "coach": {
      if (!Array.isArray(parsed.guidance)) return null;
      return plural(parsed.guidance.length, "recommendation");
    }
    default:
      return null;
  }
}

/**
 * Overall tone of a journey stage, from the sentiment of its themes:
 * negative only → "negative", negative and positive → "mixed",
 * positive only → "positive", otherwise "neutral". Drives the point colours
 * on the journey chart (negative = red, mixed = yellow).
 */
export function stageTone(
  stage: { issues?: { sentiment?: string }[] },
): "negative" | "mixed" | "positive" | "neutral" {
  const issues = stage?.issues ?? [];
  const neg = issues.some((i) => i?.sentiment === "negative");
  const pos = issues.some((i) => i?.sentiment === "positive");
  if (neg && pos) return "mixed";
  if (neg) return "negative";
  if (pos) return "positive";
  return "neutral";
}

/**
 * Colour per stage tone on the journey chart and stage lists: negative =
 * red, mixed = yellow; positive and neutral stages keep the step colour.
 */
export const TONE_COLOR: Record<ReturnType<typeof stageTone>, string> = {
  negative: "var(--red-text)",
  mixed: "var(--amber-dot)",
  positive: "var(--step-journey)",
  neutral: "var(--step-journey)",
};

/** A journey stage shows friction when any theme mapped to it is negative. */
export function stageHasFriction(stage: { issues?: { sentiment?: string }[] }): boolean {
  return (stage?.issues ?? []).some((i) => i?.sentiment === "negative");
}

/**
 * Safety review progress: how many of the current risks carry a decision.
 * Counted from the risks array so decisions left over from a previous run
 * never inflate the total.
 */
export function safetyReviewCounts(
  output: string | undefined,
  approvals: Record<string, ItemApproval> | undefined,
): { total: number; reviewed: number } | null {
  const parsed = parse(output);
  if (!parsed || !Array.isArray(parsed.risks)) return null;
  const total = parsed.risks.length;
  const reviewed = parsed.risks.filter((r: any) => approvals?.[r?.id]).length;
  return { total, reviewed };
}

/**
 * UX Coach review progress. Coach items have no decisions of their own —
 * each one mirrors the Safety decision on the risk it responds to — so this
 * counts the recommendations still shown (not dismissed in Safety) and how
 * many of those the researcher has already decided on.
 */
export function coachReviewCounts(
  output: string | undefined,
  safetyOutput: string | undefined,
  safetyApprovals: Record<string, ItemApproval> | undefined,
): { total: number; reviewed: number } | null {
  const parsed = parse(output);
  if (!parsed || !Array.isArray(parsed.guidance)) return null;
  const safety = parse(safetyOutput);
  const riskIds = new Set<string>(
    Array.isArray(safety?.risks) ? safety.risks.map((r: any) => r?.id) : [],
  );
  const visible = parsed.guidance.filter(
    (g: any) =>
      riskIds.has(g?.risk_id) && safetyApprovals?.[g.risk_id]?.status !== "dismissed",
  );
  const reviewed = visible.filter((g: any) => safetyApprovals?.[g.risk_id]).length;
  return { total: visible.length, reviewed };
}

/**
 * Emotion → chart height (0–100). The Journey Mapper returns an emotion word
 * per stage but no score, so the curve is placed from a small lexicon, and
 * falls back to the balance of the stage's theme sentiments.
 */
const EMOTION_SCORES: [RegExp, number][] = [
  [/delight|happy|joy|excit|thrill|grateful|pleased|satisf/i, 85],
  [/optimis|hope|confiden|positive|eager|motivat/i, 80],
  [/relie|reassur|calm|comfort|content|at ease/i, 72],
  [/neutral|indifferent|unknown|mixed/i, 50],
  [/uncertain|unsure|confus|curious|hesitant|doubt|cautious|wary|ambivalent/i, 45],
  [/anxious|worr|nervous|concern|stress|impatien|overwhelm|disappoint/i, 30],
  [/frustrat|annoy|irritat|upset/i, 25],
  [/exasperat|angry|anger|furious|despair|helpless|distress|fear|scared|abandon/i, 12],
];

export function emotionScore(
  emotion: string | undefined,
  issues: { sentiment?: string }[] = [],
): number {
  for (const [re, score] of EMOTION_SCORES) {
    if (emotion && re.test(emotion)) return score;
  }
  if (issues.length === 0) return 50;
  const pos = issues.filter((i) => i.sentiment === "positive").length;
  const neg = issues.filter((i) => i.sentiment === "negative").length;
  return Math.round(50 + (35 * (pos - neg)) / issues.length);
}

/** Groups indices of contiguous `true` flags into [start, end] runs. */
export function contiguousRuns(flags: boolean[]): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  flags.forEach((f, i) => {
    if (f && start < 0) start = i;
    if (!f && start >= 0) {
      runs.push([start, i - 1]);
      start = -1;
    }
  });
  if (start >= 0) runs.push([start, flags.length - 1]);
  return runs;
}

/**
 * Cubic bezier segments of a smooth curve through points (Catmull-Rom →
 * cubic bezier), as [c1x, c1y, c2x, c2y, x, y] from the previous point.
 * Control points are clamped vertically to their segment so the curve never
 * overshoots past a local minimum/maximum (horizontal tangent at the lowest
 * point).
 */
export function smoothSegments(pts: [number, number][]): number[][] {
  const clampY = (y: number, a: number, b: number) =>
    Math.min(Math.max(y, Math.min(a, b)), Math.max(a, b));
  const segments: number[][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    segments.push([
      p1[0] + (p2[0] - p0[0]) / 6,
      clampY(p1[1] + (p2[1] - p0[1]) / 6, p1[1], p2[1]),
      p2[0] - (p3[0] - p1[0]) / 6,
      clampY(p2[1] - (p3[1] - p1[1]) / 6, p1[1], p2[1]),
      p2[0],
      p2[1],
    ]);
  }
  return segments;
}

/** SVG path of the smooth curve through points (see smoothSegments). */
export function smoothPath(pts: [number, number][]): string {
  if (pts.length === 0) return "";
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (const seg of smoothSegments(pts)) d += ` C${seg.map(f).join(" ")}`;
  return d;
}

/**
 * Label colour that renders a Label box as a group-frame caption (mono,
 * uppercase, no pill) instead of a coloured pill. Not offered in the label
 * colour picker; used by the demo board's group captions.
 */
export const GROUP_LABEL_COLOR = "transparent";

/**
 * What each box is for — shown in the tooltip above its icon (node header
 * and the Add Box panel). Wording from the team's walkthrough script.
 */
export const BOX_USAGE: Partial<Record<BoxType, string>> = {
  text:
    "Start here with your research material: paste interview notes directly. For this demo, a few test transcripts are ready to use.",
  documents:
    "Start here with your research material: upload a TXT, PDF or Word document instead of pasting it.",
  insight:
    "Identifies the key themes from the research and keeps the supporting quotes with them, so you can see where each finding came from. If one theme looks off, you can rerun just that one.",
  journey:
    "Turns the findings into the patient journey and highlights where things went smoothly or where friction occurred.",
  safety:
    "Checks the journey for potential safety concerns and links each concern back to the evidence.",
  coach:
    "Suggests possible next steps for the researcher. These are recommendations only — the researcher still makes the final decision.",
  summary:
    "Brings the findings from every step of the pipeline together in one summary you can download as a PDF.",
};
