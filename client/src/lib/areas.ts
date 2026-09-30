/**
 * Pure geometry helpers for drawing rectangular areas on the canvas.
 * Areas are React Flow nodes (type "area", zIndex -1 so they render BELOW
 * boxes) whose bounds come from a drag gesture: `start` is where the mouse
 * went down and `end` where it was released — in flow coordinates.
 */

/**
 * The neutral group-frame look (design tokens group-fill / group-border).
 * Used by the demo board's frames and offered in the area colour picker.
 */
export const NEUTRAL_AREA = {
  fill: "rgba(255,255,255,0.45)",
  border: "rgba(22,24,29,0.1)",
  name: "Neutral",
};

/** Drags smaller than this (in flow units) are treated as accidental clicks. */
export const MIN_AREA_SIZE = 24;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Normalizes a drag into a top-left anchored rectangle, regardless of the
 * direction the user dragged (left→right, right→left, up→down, down→up).
 */
export function normalizeRect(start: { x: number; y: number }, end: { x: number; y: number }): Rect {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

/** True when a rect is big enough to be a deliberate area, not a stray click. */
export function isValidAreaSize(rect: Rect): boolean {
  return rect.width >= MIN_AREA_SIZE && rect.height >= MIN_AREA_SIZE;
}
/**
 * Outer group frames (`data.fit = { ids, pad, header }`) are fixed visual
 * containers around their boxes:
 *  - they are placed and sized from the boxes' bounding box (plus `pad`
 *    on the sides/bottom and a `header` row on top for the caption), so a
 *    box that grows, or is moved further out in any direction, stays inside;
 *  - they can't be selected, dragged or resized, and let pointer events
 *    through, so dragging on a frame pans the canvas.
 * Box sizes come from React Flow's measurements (auto-height boxes stretch
 * the frame after a run). Display only — nothing is written to the store.
 */
export function fitGroupFrames<
  N extends {
    id: string;
    position: { x: number; y: number };
    style?: Record<string, any>;
    data?: any;
    width?: number;
    height?: number;
    measured?: { width?: number; height?: number };
    draggable?: boolean;
    selectable?: boolean;
    focusable?: boolean;
  },
>(nodes: N[]): N[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const size = (n: N) => ({
    w: n.measured?.width ?? n.width ?? (Number(n.style?.width) || 0),
    h: n.measured?.height ?? n.height ?? (Number(n.style?.height) || 0),
  });
  return nodes.map((frame) => {
    const fit = frame.data?.fit as { ids: string[]; pad: number; header?: number } | undefined;
    if (!fit) return frame;
    const fixed = {
      ...frame,
      draggable: false,
      selectable: false,
      focusable: false,
      style: { ...frame.style, pointerEvents: "none" },
    };
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const id of fit.ids) {
      const child = byId.get(id);
      if (!child) continue;
      const { w, h } = size(child);
      if (!w || !h) return fixed; // not measured yet — keep the stored box
      left = Math.min(left, child.position.x);
      top = Math.min(top, child.position.y);
      right = Math.max(right, child.position.x + w);
      bottom = Math.max(bottom, child.position.y + h);
    }
    if (!isFinite(left)) return fixed;
    const header = fit.header ?? fit.pad;
    return {
      ...fixed,
      position: { x: Math.round(left - fit.pad), y: Math.round(top - header) },
      style: {
        ...fixed.style,
        width: Math.round(right - left + fit.pad * 2),
        height: Math.round(bottom - top + header + fit.pad),
      },
    };
  });
}

/**
 * Takes a box out of every group frame that hugs it (removes its id from
 * `data.fit.ids`), so the frame stops following it and shrinks back around
 * the boxes that remain. Returns the same array when nothing changed.
 */
export function detachFromFrames<N extends { id: string; data?: any }>(
  nodes: N[],
  boxId: string,
): N[] {
  let changed = false;
  const next = nodes.map((n) => {
    const fit = n.data?.fit as { ids: string[]; pad: number } | undefined;
    if (!fit || !fit.ids.includes(boxId)) return n;
    changed = true;
    return { ...n, data: { ...n.data, fit: { ...fit, ids: fit.ids.filter((i) => i !== boxId) } } };
  });
  return changed ? next : nodes;
}
