import { useBoardStore } from "../store/boardStore.js";
import { BOX_TYPES } from "../types.js";
import type { BoxType, BoxCategory } from "../types.js";
import { useReactFlow } from "@xyflow/react";
import { BOX_USAGE, STEP_STYLE } from "../lib/nodeView.js";
import { BoxIcon, ChevronLeftIcon, CloseIcon } from "./ui/icons.js";

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

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const addBox = useBoardStore((s) => s.addBox);

  const { screenToFlowPosition } = useReactFlow();

  const handleAdd = (type: BoxType) => {
    const position = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    addBox(type, position);
  };

  const boxesByCategory = (cat: BoxCategory) =>
    (
      Object.entries(BOX_TYPES) as [BoxType, (typeof BOX_TYPES)[BoxType]][]
    ).filter(([, meta]) => meta.category === cat);

  return (
    <>
      {/* Collapsed tab — shows when sidebar is hidden */}
      {!open && (
        <button
          onClick={onToggle}
          className="sidebar-tab absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-surface [box-shadow:var(--shadow-float)] rounded-l-[10px] w-8 h-16 flex items-center justify-center text-ink-icon hover:text-ink hover:bg-surface-sunken transition border border-r-0 border-line"
          title="Show panel"
        >
          <ChevronLeftIcon />
        </button>
      )}

      {/* Sidebar panel */}
      <div
        className={
          "absolute right-0 top-0 bottom-0 z-20 bg-surface [box-shadow:var(--shadow-float)] border-l border-line " +
          "transition-transform duration-300 flex flex-col " +
          (open ? "translate-x-0" : "translate-x-full")
        }
        style={{ width: "232px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-[46px] border-b border-line-divider flex-shrink-0">
          <span className="text-[14px] font-semibold text-ink">
            Add Box
          </span>
          <button
            onClick={onToggle}
            className="text-ink-icon hover:text-ink transition w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface-sunken"
            title="Hide panel"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Scrollable palette */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
          {SECTIONS.map((section) => {
            const boxes = boxesByCategory(section.category);
            if (boxes.length === 0) return null;
            return (
              <div key={section.title}>
                <h3 className="mono-label mb-1.5 px-1">
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {boxes.map(([type, meta]) => (
                    <button
                      key={type}
                      onClick={() => handleAdd(type)}
                      className="palette-row w-full flex items-center gap-2.5 pl-2 pr-2.5 py-1.5 rounded-[9px] border border-transparent bg-surface text-left transition-colors hover:bg-surface-sunken"
                      title={BOX_USAGE[type] ?? meta.description}
                    >
                      <span
                        className="node-tile !w-7 !h-7 !rounded-[8px]"
                        style={
                          {
                            "--tile-color": STEP_STYLE[type]?.color ?? "var(--ink)",
                          } as React.CSSProperties
                        }
                        aria-hidden
                      >
                        <BoxIcon type={type} size={15} />
                      </span>
                      <span className="flex-1 text-[13px] font-medium text-ink truncate">
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
