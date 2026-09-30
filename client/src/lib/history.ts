import type { Edge, Node } from "@xyflow/react";
import type { BoxData } from "../types.js";

/**
 * Undo / redo for the board (Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y).
 *
 * The store records a snapshot of the board BEFORE each of the user's own
 * edits (moving, resizing, adding/deleting, connecting, renaming, typing,
 * approving, recolouring, Reset). AI runs are not recorded, so undo never
 * throws away a result that was just generated.
 *
 * Bursts of the same edit — one drag, a run of typing in one box — are
 * coalesced into a single step (see `shouldRecord`).
 */

export interface BoardSnapshot {
  nodes: Node[];
  edges: Edge[];
  boxData: Record<string, BoxData>;
}

/** Max steps kept. */
export const HISTORY_LIMIT = 100;
/** Same-key edits closer together than this merge into one undo step. */
export const COALESCE_MS = 800;

/** A snapshot without view-only state (selection, dragging). */
export function takeSnapshot(state: BoardSnapshot): BoardSnapshot {
  return {
    nodes: state.nodes.map(({ selected: _s, dragging: _d, ...rest }) => rest as Node),
    edges: state.edges.map(({ selected: _s, ...rest }) => rest as Edge),
    boxData: state.boxData,
  };
}

/**
 * Board data to restore from a snapshot. Boxes that are running right now
 * keep their live entry (the run is still in flight and will write its
 * result), and a snapshot never brings back a stale "running" status.
 */
export function restoreBoxData(
  snapshot: Record<string, BoxData>,
  current: Record<string, BoxData>,
): Record<string, BoxData> {
  const out: Record<string, BoxData> = {};
  for (const [id, data] of Object.entries(snapshot)) {
    const liveStatus = current[id]?.status;
    if (liveStatus === "running" || liveStatus === "queued") {
      out[id] = current[id];
    } else if (data.status === "running" || data.status === "queued") {
      out[id] = { ...data, status: data.output?.trim() ? "done" : "idle" };
    } else {
      out[id] = data;
    }
  }
  return out;
}

/**
 * Whether an edit starts a new undo step: yes unless it has the same key as
 * the previous edit and follows it within COALESCE_MS.
 */
export function shouldRecord(
  key: string,
  now: number,
  last: { key: string; at: number } | null,
): boolean {
  return !last || last.key !== key || now - last.at >= COALESCE_MS;
}

/** updateBoxData patches that come from AI runs, not from the user. */
const RUN_KEYS = ["status", "tokens", "history", "currentVersionId", "lastRunInputHash"];
export function isUserPatch(patch: Record<string, unknown>): boolean {
  return !RUN_KEYS.some((k) => k in patch);
}

/** The undo / redo stacks, as a tiny self-contained helper. */
export function createHistory() {
  let past: BoardSnapshot[] = [];
  let future: BoardSnapshot[] = [];
  let last: { key: string; at: number } | null = null;

  return {
    /** Call BEFORE applying a user edit, with the current board. */
    record(key: string, current: BoardSnapshot, now = Date.now()) {
      if (shouldRecord(key, now, last)) {
        past.push(takeSnapshot(current));
        if (past.length > HISTORY_LIMIT) past.shift();
        future = [];
      }
      last = { key, at: now };
    },
    /** Returns the snapshot to restore, or null when there's nothing to undo. */
    undo(current: BoardSnapshot): BoardSnapshot | null {
      const prev = past.pop();
      if (!prev) return null;
      future.push(takeSnapshot(current));
      last = null;
      return prev;
    },
    redo(current: BoardSnapshot): BoardSnapshot | null {
      const next = future.pop();
      if (!next) return null;
      past.push(takeSnapshot(current));
      last = null;
      return next;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    clear() {
      past = [];
      future = [];
      last = null;
    },
  };
}
