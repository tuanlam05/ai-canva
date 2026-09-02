export type BoxType = 
  | "idea"
  | "research"
  | "summarize"
  | "image"
  | "cartoon"
  | "slides"
  | "code"
  | "prd"
  | "devplan"
  | "ui"
  | "stitch";

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
  idea: {
    label: "Idea",
    icon: "💡",
    color: "#fbbf24",
    description: "Write down a basic idea. No AI — just your text.",
    hasAI: false,
    category: "input",
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 320,
    defaultHeight: 200,
  },
  research: {
    label: "Research",
    icon: "🔍",
    color: "#60a5fa",
    description: "Research a topic using AI. Takes input from connected boxes.",
    hasAI: true,
    category: "worker",
    defaultPrompt:
      "Research the following topic thoroughly. Provide key findings, relevant context, market landscape, and potential risks. Format as Markdown with clear headings.\n\nTopic:\n{{input_1}}",
    defaultSystemPrompt:
      "You are a thorough research assistant. Provide well-structured, factual findings in Markdown format. Be concise but comprehensive.",
    defaultWidth: 320,
    defaultHeight: 320,
  },
  summarize: {
    label: "Summarize",
    icon: "📋",
    color: "#a78bfa",
    description: "Combine and summarize multiple inputs into a concise overview.",
    hasAI: true,
    category: "worker",
    defaultPrompt:
      "Synthesize the following inputs into a clear, concise summary. Identify common themes, key points, and any contradictions. Format as Markdown.\n\n{{inputs}}",
    defaultSystemPrompt:
      "You are a synthesis expert. Combine multiple inputs into a clear, concise summary in Markdown format. Highlight key insights.",
    defaultWidth: 320,
    defaultHeight: 320,
  },
  image: {
    label: "Image",
    icon: "🖼️",
    color: "#34d399",
    description: "Upload an image. The image becomes input for downstream boxes.",
    hasAI: false,
    category: "input",
    defaultPrompt: "",
    defaultSystemPrompt: "",
    defaultWidth: 320,
    defaultHeight: 320,
  },
  cartoon: {
    label: "Cartoon Profile",
    icon: "🎨",
    color: "#f472b6",
    description: "Generate cartoon profile pictures. Connect an Image box for image-to-image, or an Idea box for text-to-image.",
    hasAI: true,
    category: "worker",
    defaultPrompt:
      "Cartoon style 3D profile picture of {{input_1}}, colorful, fun, stylized cartoon character, clean simple background, professional avatar",
    defaultSystemPrompt: "",
    defaultWidth: 320,
    defaultHeight: 380,
  },
  slides: {
    label: "Slides",
    icon: "📊",
    color: "#fb923c",
    description: "Generate a pitch deck from research. Takes input from connected boxes and creates visual slides.",
    hasAI: true,
    category: "worker",
    defaultPrompt:
      "Create a 10-slide startup pitch deck from the following research. Each slide should have a clear title and 3-5 concise bullet points.\n\nSlide structure:\n1. Problem — What pain point exists?\n2. Solution — How does your product solve it?\n3. Market Size — How big is the opportunity?\n4. Product — Key features and demo highlights\n5. Business Model — How do you make money?\n6. Traction — Current progress and metrics\n7. Competition — Competitive landscape and advantage\n8. Team — Who is building this?\n9. Financials — Key projections\n10. Ask — What do you need from investors?\n\nOutput as JSON array: [{\"title\": \"...\", \"bullets\": [\"...\", \"...\"], \"notes\": \"...\"}]\n\nResearch:\n{{inputs}}",
    defaultSystemPrompt:
      "You are a pitch deck creator. You create concise, impactful slides from research data. Output ONLY a valid JSON array of slide objects. Each slide has a \"title\" (string), \"bullets\" (array of strings, 3-5 items), and optional \"notes\" (string with speaker notes). Do not include any text before or after the JSON array.",
    defaultWidth: 380,
    defaultHeight: 380,
  },
  code: {
    label: "Code",
    icon: "💻",
    color: "#22d3ee",
    description: "Generate a React prototype from research. Live preview in the box.",
    hasAI: true,
    category: "worker",
    defaultPrompt:
      "Create a React prototype for the following requirements. Use React hooks (React.useState, React.useEffect, etc.) and inline styles for all styling. Keep it SIMPLE: use small mock data (3-5 items max), focus on the core UI and interactivity. Do NOT generate extensive data arrays or constant definitions. The output must be a complete working component with the App function and ReactDOM.createRoot render call.\n\nRequirements:\n{{inputs}}",
    defaultSystemPrompt:
      "You are a React developer. You write clean, working React components. Output ONLY JavaScript/JSX code. No HTML wrapper, no script tags, no markdown code blocks, no explanation. Use the React.* API (React.useState, React.useEffect) — do not use import statements. Define a component called App. End with ReactDOM.createRoot(document.getElementById('root')).render(<App />). Use inline styles for all styling. CRITICAL: Keep mock data SMALL (3-5 items maximum). Do NOT generate extensive data arrays, long constant lists, or large data definitions. Focus on the UI component, interactivity, and visual design. The output MUST include the full App component and the ReactDOM.createRoot render call.",
    defaultWidth: 440,
    defaultHeight: 420,
  },
  prd: {
    label: "PRD",
    icon: "📄",
    color: "#818cf8",
    description: "Generate a Product Requirements Document from research. Structures findings into features, user stories, and specs for the Code box.",
    hasAI: true,
    category: "worker",
    defaultPrompt:
      "Create a Product Requirements Document (PRD) based on the following research and ideas. Structure it with these sections:\n\n## Product Overview\nBrief description of what we are building and why.\n\n## Problem Statement\nWhat pain point does this solve? Who has this problem?\n\n## Target Users\nWho are the primary users? What are their needs?\n\n## Core Features\nList the key features with priority (P0 = must have, P1 = should have, P2 = nice to have).\n\n## User Stories\nWrite 3-5 user stories in the format: As a [user], I want to [action] so that [benefit].\n\n## UI/UX Guidelines\nKey screens, layout considerations, and design principles.\n\n## Technical Requirements\nTechnology stack recommendations, key constraints, and dependencies.\n\n## Success Metrics\nHow will we measure if this product is successful?\n\nResearch & Ideas:\n{{inputs}}",
    defaultSystemPrompt:
      "You are a product manager. You create clear, structured Product Requirements Documents (PRDs) from research and ideas. Format as Markdown with clear headings, bullet points, and numbered lists. Be specific and actionable — this PRD will be used by developers to build a prototype.",
    defaultWidth: 360,
    defaultHeight: 380,
  },
  devplan: {
    label: "Dev Plan",
    icon: "🗺️",
    color: "#14b8a6",
    description: "Transform a PRD into a detailed development plan with components, state, and implementation steps for the Code box.",
    hasAI: true,
    category: "worker",
    defaultPrompt:
      "Create a simple development plan for a React prototype based on this PRD. Keep it short and practical.\n\nList:\n1. Components to build (names + 1-line purpose)\n2. State variables (names + types)\n3. Key functions (names + what they do)\n4. Build order (3-5 steps)\n\nThis is for a simple prototype. Use small mock data. Do NOT over-engineer.\n\nPRD:\n{{inputs}}",
    defaultSystemPrompt:
      "You are a pragmatic developer. Create SHORT, simple development plans for React prototypes. Use React hooks and inline styles. Keep everything minimal — this is a prototype, not production. Be concise.",
    defaultWidth: 360,
    defaultHeight: 380,
  },
  ui: {
    label: "UI Design",
    icon: "✨",
    color: "#c026d3",
    description: "Generate beautiful, production-quality React UIs with Tailwind CSS.",
    hasAI: true,
    category: "worker",
    defaultPrompt:
      "Design a beautiful React UI for the following. Use Tailwind CSS classes for ALL styling (no inline styles). Make it look like a real polished product.\n\nDesign requirements:\n- Modern, clean design with attention to detail\n- Good spacing, typography, and color harmony\n- Use gradients, shadows, rounded corners, and smooth transitions\n- Hover states on interactive elements\n- Include at least one gradient or glassmorphism effect\n- Make it responsive\n- Use small mock data (3-5 items)\n\nOutput ONLY JavaScript/JSX code. Use React hooks (React.useState, React.useEffect). Define a component called App. End with ReactDOM.createRoot(document.getElementById('root')).render(<App />).\n\nDescription:\n{{inputs}}",
    defaultSystemPrompt:
      "You are an expert UI designer and React developer. You create beautiful, modern, production-quality user interfaces using Tailwind CSS classes. Focus on visual polish: gradients, shadows, rounded corners, good typography, proper spacing, and smooth transitions. Make it look like a real product — not a demo. Output ONLY JavaScript/JSX code. Use the React.* API. Define App component. End with ReactDOM.createRoot(document.getElementById('root')).render(<App />).",
    defaultWidth: 440,
    defaultHeight: 420,
  },
  stitch: {
    label: "Stitch UI",
    icon: "🧵",
    color: "#0ea5e9",
    description: "Generate beautiful UI screens using Google Stitch. Returns production-quality HTML directly.",
    hasAI: true,
    category: "worker",
    defaultPrompt:
      "Generate a beautiful, modern UI screen for the following. Make it polished and production-ready with good spacing, typography, and visual design.\n\nDescription:\n{{inputs}}",
    defaultSystemPrompt: "",
    defaultWidth: 440,
    defaultHeight: 420,
  },
};