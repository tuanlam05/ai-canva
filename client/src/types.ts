export type BoxType =
  | "text"
  | "documents"
  | "insight"
  | "journey"
  | "safety"
  | "coach"
  | "custom"
  | "checklist"
  | "label"
  | "note";

/**
 * One task in a Checklist box — the team's shared to-do list. Every field is
 * always defined (no `undefined`) because these objects live inside a BoxData
 * array and Firestore rejects `undefined` anywhere in a nested value.
 *
 * Attribution is deliberately stored per item: a checklist is edited by the
 * whole team (last-write-wins between simultaneous users, like notes), so
 * "who added it" and "who ticked it off" are part of the record.
 */
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  /** Email of the teammate who owns the task ("" = unassigned). */
  assignee: string;
  /** Who added the task (email) and when (epoch ms). */
  createdBy: string;
  createdAt: number;
  /** Who ticked it off and when ("" / 0 while the task is still open). */
  doneBy: string;
  doneAt: number;
}

export type BoxStatus = "idle" | "running" | "done" | "error";

/**
 * A document attached to a Documents box. All fields are always defined (no
 * `undefined`) so the object survives Firestore writes, which reject
 * `undefined` anywhere in a nested value.
 */
export interface BoxDocument {
  id: string;
  /** Original filename (kept for labeling in prompts and the file list). */
  name: string;
  /** Raw file size in bytes. */
  size: number;
  /** Lowercase extension without the dot ("pdf", "txt", …). */
  ext: string;
  /** Storage download URL — "" when the file was not uploaded (local mode). */
  url: string;
  /** Extracted text — "" when extraction failed (see error). */
  text: string;
  /** Characters of extracted text actually kept (after any truncation). */
  chars: number;
  /** True when the extracted text was capped (see lib/documents.ts limits). */
  truncated: boolean;
  /** "" when extraction succeeded, otherwise a short failure reason. */
  error: string;
}

/** A user currently active on a board with their cursor position. */
export interface PresenceUser {
  userId: string;
  email: string;
  displayName: string;
  initials: string;
  color: string;
  cursorX: number;
  cursorY: number;
  /** False when the user is online (heartbeat) but has never moved their
   *  cursor — Cursors skips those so no stray cursor renders at (0, 0). */
  hasCursor?: boolean;
}

/** A connected upstream input with its box name and output. */
export interface NamedInput {
  name: string;
  output: string;
}

/** Data stored per-box, separate from React Flow's graph nodes. */
export interface BoxData {
  content: string;
  prompt: string;
  systemPrompt: string;
  output: string;
  status: BoxStatus;
  error?: string;
  imageData?: string;
  outputImage?: string;
  /** For Documents boxes: the uploaded files + their extracted text. */
  documents?: BoxDocument[];
  /** Token usage from the most recent LLM call for this box (text AI boxes). */
  tokens?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** For Note boxes: who created the note (set once at creation). */
  authorEmail?: string;
  authorName?: string;
  /** For Label boxes: the pill's background color (one of LABEL_COLORS). */
  labelColor?: string;
  /**
   * For Checklist boxes: the shared team to-do items (see
   * `client/src/lib/checklist.ts` for every mutation and the paste parser).
   */
  checklistItems?: ChecklistItem[];
}

/** Metadata for each box type. */
export type BoxCategory =
  | "input"
  | "worker"
  | "collab"
  | "companion"
  | "custom"
  | "sdlc";

/**
 * A role/persona a box is aimed at. Boxes tagged `"everyone"` appear in every
 * role view (they are shared pipeline scaffolding). See `docs/BOX_TYPES.md`.
 */
export type BoxRole =
  | "everyone"
  | "designer"
  | "developer"
  | "product"
  | "sdlc";

export interface BoxTypeMeta {
  label: string;
  icon: string;
  color: string;
  description: string;
  hasAI: boolean;
  category: BoxCategory;
  /** Role tags used to filter the palette per persona (labels, not permissions). */
  roles: BoxRole[];
  defaultPrompt: string;
  defaultSystemPrompt: string;
  defaultWidth: number;
  defaultHeight: number;
}

export const BOX_TYPES: Record<BoxType, BoxTypeMeta> = {
  text: {
    label: "Text Context",
    icon: "💡",
    color: "#fbbf24",
    description:
      "Write down simple context for your research project, in text form.",
    hasAI: false,
    category: "input",
    roles: ["everyone"],
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 320,
    defaultHeight: 200,
  },
  insight: {
    label: "Insight Weaver",
    icon: "🔍",
    color: "#60a5fa",
    description:
      "Extracts themes and pain points from research transcripts, with verified quotes, sources, and sentiment.",
    hasAI: true,
    category: "worker",
    roles: ["everyone"],
    defaultPrompt:
      "Identify recurring themes in the following research material — this includes pain points, points of confusion, AND things that work well or receive positive feedback. Aim for 5 to 8 distinct themes, but let the evidence decide the exact number: if the material only clearly supports fewer than 5 well-evidenced themes, return fewer — do not invent or split themes just to reach 5. If there are more than 8 genuinely distinct issues, merge closely related ones under a single broader theme rather than exceeding 8. Each theme must be genuinely distinct — do not create two themes that describe the same underlying pattern with different wording. For each theme, provide a short description, classify its sentiment, and cite the exact participant(s) and verbatim quotes that support it. Only include themes with direct textual evidence — do not infer themes that aren't explicitly supported by quotes.\n\nResearch Material:\n{{inputs}}",
    defaultSystemPrompt:
      'You are a UX research synthesis assistant. You only draw conclusions from the research material provided to you — never from general knowledge, assumptions, or information not present in the supplied documents. Every finding you produce must include a direct, verbatim quote from the source material as evidence. If you cannot find a verbatim quote to support a claim, do not include that claim.\n\nEach theme must have a unique ID in the format "theme-1", "theme-2", "theme-3", etc. Assign IDs sequentially starting from "theme-1". The ID identifies the theme and must be unique within this output.\n\nClassify each theme\'s sentiment as exactly one of these three values — no other values are allowed:\n- "negative": a pain point, problem, or complaint\n- "positive": a compliment or something explicitly working well\n- "neutral": a factual observation with no clear positive or negative charge\n\nOutput strictly in the following JSON structure — no prose outside the JSON:\n\n{\n  "themes": [\n    {\n      "id": "theme-1",\n      "theme": "short theme name",\n      "description": "1-2 sentence description of the pattern",\n      "sentiment": "positive" | "negative" | "neutral",\n      "evidence": [\n        { "quote": "exact verbatim quote from source", "source": "participant/document name" }\n      ]\n    }\n  ]\n}',
    defaultWidth: 320,
    defaultHeight: 320,
  },
  journey: {
    label: "Journey Mapper",
    icon: "🗺️",
    color: "#a78bfa",
    description:
      "Infers a generic app-flow structure and maps grounded themes onto each stage, preserving sentiment.",
    hasAI: true,
    category: "worker",
    roles: ["everyone"],
    defaultPrompt:
      "Infer a plausible, generic sequence of stages a user would typically go through in this kind of app (e.g. onboarding, dashboard navigation, using a core feature, etc.) — this stage skeleton is your general knowledge of typical app flows, not something drawn from the research material. Then, map ONLY the negative themes below (pain points, problems, confusion) onto whichever stage they most plausibly occurred at. Ignore positive and neutral themes entirely — they are out of scope for this journey. Stay strictly grounded for the theme/evidence content itself — do not alter or embellish the quotes, descriptions, or sentiment. A stage may have zero issues mapped to it if no negative theme fits there; do not force a theme into a stage it doesn't clearly belong to, and do not invent extra issues to fill an empty stage.\n\nThemes:\n{{inputs}}",
    defaultSystemPrompt:
      'You are a UX journey mapping assistant focused specifically on identifying friction points. You perform two distinct tasks: (1) inferring a plausible generic app-flow structure (stages), which draws on general UX knowledge of typical app patterns — clearly a structural assumption, not a grounded claim; and (2) mapping ONLY negative-sentiment themes\' evidence onto that structure, which must remain strictly grounded — do not alter quotes, do not invent evidence, do not include positive or neutral themes, do not force themes into stages where they don\'t clearly belong.\n\nOutput strictly in the following JSON structure — no prose outside the JSON:\n\n{\n  "stages": [\n    {\n      "stage_name": "short name for this generic app stage",\n      "stage_description": "one sentence on what typically happens at this stage",\n      "issues": [\n        {\n          "theme": "theme name, unchanged from input",\n          "description": "theme description, unchanged from input",\n          "evidence": [\n            { "quote": "exact verbatim quote from source", "source": "participant/document name" }\n          ]\n        }\n      ]\n    }\n  ]\n}\n\nA stage\'s "issues" array may be empty if no negative theme fits that stage — this is expected and correct, not an error to fix.',
    defaultWidth: 320,
    defaultHeight: 320,
  },
  safety: {
    label: "Patient Safety Reviewer",
    icon: "🩺",
    color: "#ef4444",
    description: "Review patient safety risks.",
    hasAI: true,
    category: "worker",
    roles: ["everyone"],
    defaultPrompt: "placeholder",
    defaultSystemPrompt: "placeholder",
    defaultWidth: 360,
    defaultHeight: 380,
  },
  coach: {
    label: "UX Coach",
    icon: "🎓",
    color: "#84cc16",
    description: "Generate a step-by-step procedure for a UX task.",
    hasAI: true,
    category: "worker",
    roles: ["everyone"],
    defaultPrompt: "placeholder",
    defaultSystemPrompt: "placeholder",
    defaultWidth: 360,
    defaultHeight: 380,
  },
  documents: {
    label: "Documents",
    icon: "📎",
    color: "#64748b",
    description:
      "Upload PDF, Word, or text files. Their extracted text becomes input for downstream boxes via {{inputs}}.",
    hasAI: false,
    category: "input",
    roles: ["everyone"],
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 340,
    defaultHeight: 380,
  },
  note: {
    label: "Note",
    icon: "🗒️",
    color: "#fbbf24",
    description:
      "A post-it style note for team communication. Everyone on the board sees it.",
    hasAI: false,
    category: "collab",
    roles: ["everyone"],
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 260,
    defaultHeight: 240,
  },
  label: {
    label: "Label",
    icon: "🏷️",
    color: "#64748b",
    description: "A simple colored text label to annotate areas of the board.",
    hasAI: false,
    category: "collab",
    roles: ["everyone"],
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 200,
    defaultHeight: 64,
  },
  checklist: {
    label: "Checklist",
    icon: "✅",
    color: "#059669",
    description:
      "A shared team to-do list. Anyone can add, assign and tick off tasks — everyone sees the same list.",
    hasAI: false,
    category: "collab",
    roles: ["everyone"],
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 320,
    defaultHeight: 340,
  },
  custom: {
    label: "Custom",
    icon: "✨",
    color: "#6366f1",
    description: "A reusable AI box you created (saved to your profile).",
    hasAI: true,
    category: "custom",
    roles: ["everyone"],
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 320,
    defaultHeight: 320,
  },
};

/** Preset pill colors for Label boxes (index 0 = default). */
export const LABEL_COLORS = [
  "#e2e8f0",
  "#fde68a",
  "#fecdd3",
  "#a5f3fc",
  "#a7f3d0",
];

/**
 * Preset area colors for drawn rectangular areas: intentionally VERY light
 * fills (Tailwind -100 shades) with slightly stronger -200/-300 borders, so
 * areas read as background grouping regions and never compete with boxes,
 * notes, or edges on top of them.
 */
export const AREA_COLORS: { fill: string; border: string; name: string }[] = [
  { fill: "#fef3c7", border: "#fde68a", name: "Amber" },
  { fill: "#dbeafe", border: "#bfdbfe", name: "Blue" },
  { fill: "#d1fae5", border: "#a7f3d0", name: "Emerald" },
  { fill: "#fce7f3", border: "#fbcfe8", name: "Pink" },
  { fill: "#ede9fe", border: "#ddd6fe", name: "Violet" },
  { fill: "#cffafe", border: "#a5f3fc", name: "Cyan" },
  { fill: "#ffedd5", border: "#fed7aa", name: "Orange" },
  { fill: "#f1f5f9", border: "#e2e8f0", name: "Slate" },
];
