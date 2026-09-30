import { memo, type CSSProperties } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { useBoardStore } from "../store/boardStore.js";
import { AREA_COLORS } from "../types.js";
import { NEUTRAL_AREA } from "../lib/areas.js";
import { CloseIcon } from "./ui/icons.js";

/** Picker swatches: the neutral frame look first, then the light colours. */
const SWATCHES = [NEUTRAL_AREA, ...AREA_COLORS];

const sameColor = (a: string, b: string) =>
  a.replace(/\s/g, "").toLowerCase() === b.replace(/\s/g, "").toLowerCase();

/**
 * A rectangular area — a background grouping region that sits UNDER the
 * boxes (created via zIndex -1 by `addArea` in boardStore, or as a group
 * frame on the demo board). Renders as a light fill, 1px border and 16px
 * radius. When selected it shows resize handles, a colour picker (neutral +
 * very light palette) and a delete button; areas can also be moved by
 * dragging and deleted with the keyboard.
 */
function AreaNodeInner({ id, data, selected }: NodeProps) {
  const setAreaColor = useBoardStore((s) => s.setAreaColor);
  const deleteBox = useBoardStore((s) => s.deleteBox);

  const fill = (data?.fill as string) || AREA_COLORS[0].fill;
  const border = (data?.border as string) || AREA_COLORS[0].border;
  // The neutral look follows the theme tokens (light and dark).
  const isNeutral = sameColor(fill, NEUTRAL_AREA.fill);

  return (
    <>
      <NodeResizer minWidth={80} minHeight={60} isVisible={!!selected} />
      <div
        className={"area-frame w-full h-full rounded-2xl" + (isNeutral ? " is-neutral" : "")}
        style={
          {
            "--area-fill": isNeutral ? "var(--group-fill)" : fill,
            "--area-border": isNeutral ? "var(--group-border)" : border,
          } as CSSProperties
        }
        title={data?.caption ? undefined : "Area — drag to move, select to resize or recolour"}
      >
        {/* Outer group frames (demo board) carry their caption in the
            46px header row; they're fixed containers, see fitGroupFrames. */}
        {typeof data?.caption === "string" && (
          <div className="absolute left-4 top-0 h-[46px] flex items-center font-mono text-[11px] font-semibold tracking-[.08em] uppercase text-ink-3 select-none">
            {data.caption}
          </div>
        )}
        {selected && (
          <>
            {/* Colour picker — neutral or very light shades only, so areas
                never compete with the boxes on top of them. */}
            <div className="nodrag absolute -top-11 left-0 flex items-center gap-1.5 rounded-[10px] bg-surface px-2 py-1.5 border border-line [box-shadow:var(--shadow-float)]">
              {SWATCHES.map((c) => {
                const active = sameColor(fill, c.fill);
                return (
                  <button
                    key={c.fill}
                    onClick={() => setAreaColor(id, c.fill, c.border)}
                    title={`Area colour — ${c.name}`}
                    aria-label={`Area colour — ${c.name}`}
                    className={
                      "area-color-dot w-5 h-5 rounded-md border transition hover:scale-110 " +
                      (active ? "scale-110 ring-2 ring-[color:var(--ink)] ring-offset-1 ring-offset-[color:var(--surface)]" : "")
                    }
                    style={{
                      backgroundColor: c === NEUTRAL_AREA ? "var(--surface)" : c.fill,
                      borderColor: c === NEUTRAL_AREA ? "var(--border-control)" : c.border,
                    }}
                  />
                );
              })}
            </div>
            {/* Delete */}
            <button
              onClick={() => deleteBox(id)}
              title="Delete area"
              aria-label="Delete area"
              className="box-delete nodrag absolute -top-4 -right-4 w-7 h-7 rounded-full bg-surface text-ink-muted hover:text-[color:var(--red-text)] border border-line [box-shadow:var(--shadow-float)] flex items-center justify-center"
            >
              <CloseIcon />
            </button>
          </>
        )}
      </div>
    </>
  );
}

export default memo(AreaNodeInner);
