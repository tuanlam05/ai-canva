import { describe, expect, it } from "vitest";
import type { BoxData } from "../types.js";
import {
  COALESCE_MS,
  createHistory,
  isUserPatch,
  restoreBoxData,
  takeSnapshot,
  type BoardSnapshot,
} from "./history.js";

const data = (patch: Partial<BoxData> = {}): BoxData => ({
  content: "",
  prompt: "",
  systemPrompt: "",
  output: "",
  status: "idle",
  ...patch,
});
const board = (x: number): BoardSnapshot => ({
  nodes: [{ id: "a", position: { x, y: 0 }, data: {}, selected: true }],
  edges: [],
  boxData: { a: data() },
});

describe("history", () => {
  it("undoes and redoes a recorded edit", () => {
    const h = createHistory();
    h.record("move", board(0), 0);
    const undone = h.undo(board(50))!;
    expect(undone.nodes[0].position.x).toBe(0);
    expect(h.canRedo()).toBe(true);
    expect(h.redo(undone)!.nodes[0].position.x).toBe(50);
  });

  it("coalesces a burst of the same edit into one step", () => {
    const h = createHistory();
    h.record("move", board(0), 0);
    h.record("move", board(10), 100);
    h.record("move", board(20), 200);
    expect(h.undo(board(30))!.nodes[0].position.x).toBe(0);
    expect(h.canUndo()).toBe(false);
  });

  it("starts a new step for a different edit or after a pause", () => {
    const h = createHistory();
    h.record("move", board(0), 0);
    h.record("move", board(10), COALESCE_MS + 1);
    h.record("rename", board(20), COALESCE_MS + 2);
    expect(h.undo(board(30))!.nodes[0].position.x).toBe(20);
    expect(h.undo(board(20))!.nodes[0].position.x).toBe(10);
    expect(h.undo(board(10))!.nodes[0].position.x).toBe(0);
  });

  it("a new edit clears the redo stack", () => {
    const h = createHistory();
    h.record("move", board(0), 0);
    h.undo(board(10));
    h.record("rename", board(0), 5000);
    expect(h.canRedo()).toBe(false);
  });

  it("drops view-only state from snapshots", () => {
    expect(takeSnapshot(board(0)).nodes[0]).not.toHaveProperty("selected");
  });
});

describe("restoreBoxData", () => {
  it("never restores a stale running status and keeps live runs", () => {
    const snap = { a: data({ status: "running", output: "x" }), b: data({ status: "running" }), c: data({ content: "old" }) };
    const current = { a: data(), b: data(), c: data({ status: "running", content: "live" }) };
    const out = restoreBoxData(snap, current);
    expect(out.a.status).toBe("done");
    expect(out.b.status).toBe("idle");
    expect(out.c.content).toBe("live");
  });
});

describe("isUserPatch", () => {
  it("separates user edits from AI-run updates", () => {
    expect(isUserPatch({ content: "x", output: "x" })).toBe(true);
    expect(isUserPatch({ prompt: "p" })).toBe(true);
    expect(isUserPatch({ status: "running" })).toBe(false);
    expect(isUserPatch({ output: "o", history: [], currentVersionId: "v" })).toBe(false);
    expect(isUserPatch({ tokens: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } })).toBe(false);
  });
});
