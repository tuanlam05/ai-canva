import { useState } from "react";
import { useBoardStore } from "../store/boardStore.js";
import { BOX_TYPES } from "../types.js";
import type { BoxType, BoxCategory, BoxRole } from "../types.js";
import { useReactFlow } from "@xyflow/react";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

const SECTIONS: { title: string; category: BoxCategory }[] = [
  { title: "Inputs", category: "input" },
  { title: "Workers", category: "worker" },
  { title: "Companions", category: "companion" },
  { title: "Collaboration", category: "collab" },
];

/** Role filters shown as a dropdown at the top of the palette. */
const ROLE_STORAGE_KEY = "ai-canva:sidebar-role";

/** The selectable role profiles (must stay in sync with the <option> list). */
const ROLES: BoxRole[] = ["designer", "developer", "product", "sdlc"];

const ROLE_LABELS: Record<BoxRole, string> = {
  everyone: "Everyone",
  designer: "🎨 Designer",
  developer: "💻 Developer",
  product: "📊 Product",
  sdlc: "🔁 SDLC",
};

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const addBox = useBoardStore((s) => s.addBox);

  const { screenToFlowPosition } = useReactFlow();

  const [role, setRole] = useState<"all" | BoxRole>(() => {
    const stored =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(ROLE_STORAGE_KEY)
        : null;
    return ROLES.includes(stored as BoxRole) ? (stored as BoxRole) : "all";
  });

  const handleAdd = (type: BoxType) => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    addBox(type, position);
  };

  const selectRole = (next: "all" | BoxRole) => {
    setRole(next);
    if (typeof localStorage !== "undefined") {
      if (next === "all") localStorage.removeItem(ROLE_STORAGE_KEY);
      else localStorage.setItem(ROLE_STORAGE_KEY, next);
    }
  };

  /** True when a box should appear under the active role filter.
   *  `everyone` boxes are shared scaffolding and show in every view. */
  const boxVisible = (meta: (typeof BOX_TYPES)[BoxType]) =>
    role === "all" ||
    meta.roles.includes("everyone") ||
    meta.roles.includes(role);

  const boxesByCategory = (cat: BoxCategory) =>
    (
      Object.entries(BOX_TYPES) as [BoxType, (typeof BOX_TYPES)[BoxType]][]
    ).filter(([, meta]) => meta.category === cat && boxVisible(meta));

  return (
    <>
      {/* Collapsed tab — shows when sidebar is hidden */}
      {!open && (
        <button
          onClick={onToggle}
          className="sidebar-tab absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white shadow-lg rounded-l-xl w-8 h-16 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition border border-r-0 border-slate-200"
          title="Show panel"
        >
          <span className="text-lg">◀</span>
        </button>
      )}

      {/* Sidebar panel */}
      <div
        className={
          "absolute right-0 top-0 bottom-0 z-20 bg-white shadow-xl border-l border-slate-200 " +
          "transition-transform duration-300 flex flex-col " +
          (open ? "translate-x-0" : "translate-x-full")
        }
        style={{ width: "232px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
          <span className="text-[13px] font-semibold text-slate-700">
            Add Box
          </span>
          <button
            onClick={onToggle}
            className="text-slate-400 hover:text-slate-600 transition w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100"
            title="Hide panel"
          >
            ✕
          </button>
        </div>

        {/* Scrollable palette */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
          {SECTIONS.map((section) => {
            const boxes = boxesByCategory(section.category);
            if (boxes.length === 0) return null;
            return (
              <div key={section.title}>
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {boxes.map(([type, meta]) => (
                    <button
                      key={type}
                      onClick={() => handleAdd(type)}
                      className="palette-row w-full flex items-center gap-2.5 pl-2 pr-2.5 py-1.5 rounded-lg border border-slate-200/70 bg-white text-left transition hover:border-slate-300 hover:shadow-sm"
                      title={meta.description}
                    >
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                        style={{ backgroundColor: meta.color + "1F" }}
                      >
                        {meta.icon}
                      </span>
                      <span className="flex-1 text-[13px] font-medium text-slate-700 truncate">
                        {meta.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
