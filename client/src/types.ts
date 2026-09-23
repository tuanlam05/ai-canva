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
  /* Researcher decisions keyed by output item id. */
  approvals?: Record<string, ItemApproval>;
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

export interface Evidence {
  quote: string;
  source: string;
}

export interface Theme {
  theme: string;
  description: string;
  evidence: Evidence[];
}

/* One safety flag produced by the Patient Safety Reviewer. */
export interface Risk {
  id: string;
  category: string;
  summary: string;
  stage: string;
  reason: string;
  theme_id: string;
  theme: string;
  evidence: Evidence[];
}

/* A researcher's decision on one output item. */
export interface ItemApproval {
  status: "approved" | "dismissed";
  by: string;
  at: number;
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
  loadingText?: string;
  errorTitle?: string;
  errorHint?: string;
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
    loadingText: "Reading transcripts for themes...",
    errorTitle: "Couldn't extract themes.",
    errorHint: "No themes were produced. The source transcript is unchanged.",
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
      "Maps grounded themes onto journey stages — supplied by the user or inferred — preserving sentiment and verbatim evidence.",
    hasAI: true,
    loadingText: "Mapping themes into journey stages...",
    errorTitle: "Couldn't build the journey map.",
    errorHint: "No stages were produced. Themes from the previous box are unchanged.",
    category: "worker",
    roles: ["everyone"],
    defaultPrompt:
      "Map the themes below onto a user journey. If any input contains a list of journey stages, use exactly those stages in that order. Otherwise, derive a plausible generic sequence of stages a user would typically go through in this kind of app. Stay strictly grounded for the theme/evidence content itself — do not alter or embellish the ids, names, descriptions, sentiment, or quotes.\n\nInputs:\n{{inputs}}",
    defaultSystemPrompt:
      'You are a UX journey mapping assistant. You map research themes onto the stages of a user journey.\n\nSTAGES\n- If any input contains a list of journey stages, use exactly those stages, in that order. Do not add, rename, split, or merge them.\n- Otherwise, derive 5 to 8 stages a user would typically pass through in this kind of app, in chronological order. These stages are a structural assumption drawn from general UX knowledge, not a claim grounded in the research.\n\nMAPPING\n- Assign each theme to the single stage where it most plausibly occurs, based on its content. Include positive, negative, and neutral themes.\n- Every theme must appear exactly once. If a theme does not clearly fit any stage, place it in a final stage named "Unassigned" rather than omitting it.\n- A stage may have zero issues. Do not invent issues to fill it.\n\nGROUNDING\n- Copy each theme\'s id, name, description, sentiment, and quotes exactly as given. Do not paraphrase, embellish, or change them.\n- Do not invent quotes, participants, or evidence.\n\nOUTPUT\nReturn only JSON in this structure — no prose before or after:\n\n{\n  "stages": [\n    {\n      "stage_name": "short name for this stage",\n      "stage_description": "one sentence on what happens at this stage",\n      "emotion": "how the user likely feels overall at this stage",\n      "issues": [\n        {\n          "theme_id": "id from input, unchanged (e.g. theme-3)",\n          "theme": "theme name, unchanged from input",\n          "description": "theme description, unchanged from input",\n          "sentiment": "positive" | "negative" | "neutral",\n          "evidence": [\n            { "quote": "exact verbatim quote from source", "source": "participant/document name" }\n          ]\n        }\n      ]\n    }\n  ]\n}',
    defaultWidth: 320,
    defaultHeight: 320,
  },
  safety: {
    label: "Patient Safety Reviewer",
    icon: "🩺",
    color: "#ef4444",
    description:
      "Flags patient-safety concerns in the journey, tracing each back to a stage, theme, and verbatim quote.",
    hasAI: true,
    loadingText: "Reviewing journey stages for safety concerns...",
    errorTitle: "Couldn't complete the safety review.",
    errorHint: "No flags were produced. Nothing has been approved or dismissed.",
    category: "worker",
    roles: ["everyone"],
    defaultPrompt:
      "Review the journey below for patient-safety concerns. Flag only what the evidence supports - do not speculate about harms with no basis in the quotes. Copy ids, theme names, and quotes exactly as given.\n\nJourney:\n{{inputs}}",
    defaultSystemPrompt:
      'You are a patient-safety reviewer for a healthcare product team. You read a user journey built from research evidence and flag the points where a patient could come to harm.\n\nFLAGGING\n- Flag a concern only when the evidence in the journey supports it. Do not invent harms, and do not flag something merely because a user was annoyed or confused with no safety consequence.\n- Each flag names exactly one stage from the journey, taken verbatim from "stage_name".\n- Each flag traces to exactly one theme: copy its "theme_id" and "theme" unchanged.\n- Copy quotes and sources exactly as given. Never paraphrase or invent them.\n- Classify each flag into one category: "Communication Risk", "Continuity of Care Risk", "Medication Risk", "Access Risk", or "Data Accuracy Risk".\n- Give each flag a unique id in the format "risk-1", "risk-2", numbered sequentially.\n- List every stage you reviewed and found no concern in "clear_stages", using the stage names verbatim.\n\nOUTPUT\nReturn only JSON in this structure - no prose before or after:\n\n{\n  "risks": [\n    {\n      "id": "risk-1",\n      "category": "one of the categories above",\n      "summary": "short summary of the concern",\n      "stage": "stage_name from the journey, unchanged",\n      "reason": "one or two sentences on why this was flagged",\n      "theme_id": "theme id from the journey, unchanged",\n      "theme": "theme name, unchanged",\n      "evidence": [\n        { "quote": "exact verbatim quote", "source": "participant/document name" }\n      ]\n    }\n  ],\n  "clear_stages": ["stage names with no concerns"]\n}',
    defaultWidth: 360,
    defaultHeight: 380,
  },
  coach: {
    label: "UX Coach",
    icon: "🎓",
    color: "#84cc16",
    description: "Generate a step-by-step procedure for a UX task.",
    hasAI: true,
    loadingText: "Preparing guidance...",
    errorTitle: "Couldn't generate guidance.",
    errorHint: "Safety review results are unaffected.",
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
