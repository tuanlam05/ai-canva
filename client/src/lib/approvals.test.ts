import { describe, expect, it } from "vitest";
import { filterApproved } from "./approvals.js";
import type { ItemApproval } from "../types.js";

/**
 * `filterApproved` is the only place a researcher's approve/dismiss decision
 * changes what the next box sees, and its effect is invisible in the UI (it
 * shows up in a prompt body), so it is covered here rather than by eye.
 */

function approval(status: "approved" | "dismissed"): ItemApproval {
  return { status, by: "Tester", at: 1_700_000_000_000 };
}

const SAFETY_OUTPUT = JSON.stringify({
  risks: [
    { id: "risk-1", category: "Communication Risk", summary: "A" },
    { id: "risk-2", category: "Access Risk", summary: "B" },
    { id: "risk-3", category: "Medication Risk", summary: "C" },
  ],
  clear_stages: ["Stage 2"],
});

/** Parses a filtered result back into risks for assertions. */
function risksOf(output: string) {
  return JSON.parse(output).risks as Array<{
    id: string;
    researcher_confirmed: boolean;
  }>;
}

describe("filterApproved", () => {
  it("drops dismissed risks", () => {
    const out = filterApproved("safety", SAFETY_OUTPUT, {
      "risk-2": approval("dismissed"),
    });
    expect(risksOf(out).map((r) => r.id)).toEqual(["risk-1", "risk-3"]);
  });

  it("keeps approved risks and marks them confirmed", () => {
    const out = filterApproved("safety", SAFETY_OUTPUT, {
      "risk-1": approval("approved"),
    });
    const risk = risksOf(out).find((r) => r.id === "risk-1");
    expect(risk?.researcher_confirmed).toBe(true);
  });

  it("keeps untouched risks, unconfirmed", () => {
    const out = filterApproved("safety", SAFETY_OUTPUT, {
      "risk-1": approval("approved"),
    });
    const risk = risksOf(out).find((r) => r.id === "risk-3");
    expect(risk?.researcher_confirmed).toBe(false);
  });

  it("preserves other top-level fields", () => {
    const out = filterApproved("safety", SAFETY_OUTPUT, {
      "risk-2": approval("dismissed"),
    });
    expect(JSON.parse(out).clear_stages).toEqual(["Stage 2"]);
  });

  it("returns unparseable output unchanged", () => {
    const raw = "Sorry, I could not produce JSON.";
    expect(filterApproved("safety", raw, { "risk-1": approval("dismissed") })).toBe(raw);
  });

  it("returns other box types unchanged", () => {
    expect(
      filterApproved("journey", SAFETY_OUTPUT, { "risk-1": approval("dismissed") }),
    ).toBe(SAFETY_OUTPUT);
  });
});
