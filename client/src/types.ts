export type BoxType =
  | "text"
  | "file"
  | "insight"
  | "journey"
  | "safety"
  | "coach";

export type BoxStatus = "idle" | "running" | "done" | "error";

/** A single slide in a generated deck. */
export interface Slide {
  title: string;
  bullets: string[];
  notes?: string;
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
  slides?: Slide[];
  /** For Code boxes: the generated React component code (JSX). */
  code?: string;
}

/** Metadata for each box type. */
export type BoxCategory = "input" | "worker" | "custom";

export interface BoxTypeMeta {
  label: string;
  icon: string;
  color: string;
  description: string;
  hasAI: boolean;
  category: BoxCategory;
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
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 320,
    defaultHeight: 200,
  },
  file: {
    label: "File Context",
    icon: "🖼️",
    color: "#34d399",
    description:
      "Upload a file to use as context for your research project. .txt and .pdf accepted.",
    hasAI: false,
    category: "input",
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 320,
    defaultHeight: 320,
  },
  insight: {
    label: "Insight Weaver",
    icon: "🔍",
    color: "#60a5fa",
    description:
      "Extracts themes and pain points from research transcripts, with verified quotes and sources.",
    hasAI: true,
    category: "worker",
    defaultPrompt: "Placeholder",
    defaultSystemPrompt: "Placeholder",
    defaultWidth: 320,
    defaultHeight: 320,
  },
  journey: {
    label: "Journey Mapper",
    icon: "📋",
    color: "#a78bfa",
    description:
      "Organizes themes into a journey with stages, emotions, and friction points, tracing back to source themes.",
    hasAI: true,
    category: "worker",
    defaultPrompt: "Placeholder",
    defaultSystemPrompt: "Placeholder",
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
    defaultPrompt: "placeholder",
    defaultSystemPrompt: "placeholder",
    defaultWidth: 360,
    defaultHeight: 380,
  },
};
