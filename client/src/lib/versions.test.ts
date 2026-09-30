import { describe, expect, it } from "vitest";
import type { BoxData } from "../types";
import { addVersion, formatVersionTime, restoreVersion } from "./versions";

const box = (patch: Partial<BoxData> = {}): BoxData => ({
  content: "",
  prompt: "",
  systemPrompt: "",
  output: "",
  status: "done",
  ...patch,
});

const approved = { "risk-1": { status: "approved" as const, by: "a", at: 1 } };

describe("addVersion", () => {
  it("adds the output as the current version", () => {
    const patch = addVersion(box(), "first", "v1", 100);
    expect(patch).toMatchObject({ output: "first", currentVersionId: "v1" });
    expect(patch.history).toEqual([{ id: "v1", timestamp: 100, output: "first" }]);
  });

  it("starts undecided and saves the decisions with the version it replaces", () => {
    const data = box({
      output: "first",
      currentVersionId: "v1",
      history: [{ id: "v1", timestamp: 100, output: "first" }],
      approvals: approved,
    });
    const patch = addVersion(data, "second", "v2", 200);
    expect(patch.approvals).toBeUndefined();
    expect(patch.history).toEqual([
      { id: "v1", timestamp: 100, output: "first", approvals: approved },
      { id: "v2", timestamp: 200, output: "second" },
    ]);
  });

  it("never writes an undefined value into the history", () => {
    const data = box({
      currentVersionId: "v1",
      history: [{ id: "v1", timestamp: 100, output: "first", approvals: approved }],
    });
    const [saved] = addVersion(data, "second", "v2", 200).history ?? [];
    // No decisions now, so none are saved (the key is dropped, not undefined).
    expect("approvals" in saved).toBe(false);
  });
});

describe("restoreVersion", () => {
  const data = box({
    output: "second",
    currentVersionId: "v2",
    approvals: { "risk-2": { status: "dismissed", by: "a", at: 2 } },
    history: [
      { id: "v1", timestamp: 100, output: "first", approvals: approved },
      { id: "v2", timestamp: 200, output: "second" },
    ],
  });

  it("makes the version current again, with its decisions", () => {
    const patch = restoreVersion(data, "v1");
    expect(patch).toMatchObject({ output: "first", currentVersionId: "v1", approvals: approved });
    // The version being left keeps its decisions, so switching back restores them.
    expect(patch?.history?.[1]).toEqual({
      id: "v2",
      timestamp: 200,
      output: "second",
      approvals: data.approvals,
    });
  });

  it("does nothing for the current or an unknown version", () => {
    expect(restoreVersion(data, "v2")).toBeNull();
    expect(restoreVersion(data, "missing")).toBeNull();
  });
});

describe("formatVersionTime", () => {
  const now = new Date(2026, 8, 29, 18, 0).getTime();

  it("names today and yesterday", () => {
    expect(formatVersionTime(new Date(2026, 8, 29, 9, 5).getTime(), now)).toMatch(/^Today, /);
    expect(formatVersionTime(new Date(2026, 8, 28, 23, 50).getTime(), now)).toMatch(/^Yesterday, /);
  });

  it("dates anything older, with the year only when it differs", () => {
    const older = formatVersionTime(new Date(2026, 8, 20, 9, 5).getTime(), now);
    expect(older).not.toMatch(/Today|Yesterday|2026/);
    expect(formatVersionTime(new Date(2025, 8, 20, 9, 5).getTime(), now)).toMatch(/2025/);
  });
});
