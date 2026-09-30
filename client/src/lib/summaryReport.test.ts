import { describe, expect, it } from "vitest";
import { buildSummaryReport, reportSections, reportStats, sectionMeta } from "./summaryReport";

const theme = (name: string, sentiment: string, sources: string[]) => ({
  theme: name,
  description: `${name} description`,
  sentiment,
  evidence: sources.map((source) => ({ quote: "q", source })),
});

const insight = JSON.stringify({
  themes: [
    theme("Booking is easy", "positive", ["Participant P1"]),
    theme("Referrals go missing", "Negative", ["Participant P3", "Participant P3", "Participant P2"]),
    theme("Appointment types", "unsure", []),
  ],
});

const safety = JSON.stringify({
  risks: [
    { id: "risk-1", category: "Access Risk", summary: "Lost referral", stage: "Referral", reason: "r" },
    { id: "risk-2", category: "Medication Risk", summary: "Unclear medicines", stage: "Home", reason: "r" },
    { id: "risk-3", category: "Communication Risk", summary: "Dismissed", stage: "Home", reason: "r" },
  ],
  clear_stages: ["Booking", ""],
});

const approvals = {
  "risk-1": { status: "approved" as const, by: "a", at: 1 },
  "risk-3": { status: "dismissed" as const, by: "a", at: 1 },
};

const coach = JSON.stringify({
  guidance: [
    { risk_id: "risk-1", stage: "Referral", plain_summary: "Confirm referrals", next_steps: ["Send it", " "] },
    { risk_id: "risk-3", plain_summary: "Advice on a dismissed risk", next_steps: ["x"] },
    { risk_id: "risk-9", plain_summary: "Risk id not found", next_steps: [] },
  ],
  research_next: [{ question: "Where do referrals stall?", why: "One case" }, { question: "" }],
});

describe("buildSummaryReport", () => {
  it("ranks themes by supporting quotes and normalises sentiment", () => {
    const report = buildSummaryReport({ insight });
    expect(report.themes?.map((t) => [t.name, t.sentiment, t.quotes])).toEqual([
      ["Referrals go missing", "negative", 3],
      ["Booking is easy", "positive", 1],
      ["Appointment types", "neutral", 0],
    ]);
    expect(report.sources).toEqual(["P1", "P2", "P3"]);
  });

  it("reads each stage's tone, friction and emotion score", () => {
    const journey = JSON.stringify({
      stages: [
        { stage_name: "Booking", emotion: "Confident", issues: [{ sentiment: "positive" }] },
        { stage_name: "Referral", emotion: "Frustrated", issues: [{ sentiment: "negative" }, { sentiment: "positive" }] },
      ],
    });
    const [booking, referral] = buildSummaryReport({ journey }).stages ?? [];
    expect(booking).toMatchObject({ tone: "positive", friction: false, score: 80 });
    expect(referral).toMatchObject({ tone: "mixed", friction: true, score: 25 });
  });

  it("leaves out dismissed risks and the advice responding to them", () => {
    const report = buildSummaryReport({ safety, safetyApprovals: approvals, coach });
    expect(report.risks?.map((r) => [r.summary, r.approved])).toEqual([
      ["Lost referral", true],
      ["Unclear medicines", false],
    ]);
    expect(report.dismissedRisks).toBe(1);
    expect(report.clearStages).toEqual(["Booking"]);
    expect(report.recommendations).toEqual([
      { title: "Confirm referrals", why: "", stage: "Referral", category: "Access Risk", steps: ["Send it"] },
      // Kept even when its risk can't be matched, just without a category.
      { title: "Risk id not found", why: "", stage: "", category: "", steps: [] },
    ]);
    expect(report.researchNext).toEqual([{ question: "Where do referrals stall?", why: "One case" }]);
  });

  it("marks boxes with no readable output as not run", () => {
    const report = buildSummaryReport({ insight: "", journey: "{oops", coach: "null" });
    expect(report.themes).toBeNull();
    expect(report.stages).toBeNull();
    expect(report.recommendations).toBeNull();
    expect(reportSections(report)).toEqual([]);
    expect(reportStats(report).map((s) => [s.value, s.detail])).toEqual([
      [null, "Not run yet"],
      [null, "Not run yet"],
      [null, "Not run yet"],
      [null, "Not run yet"],
    ]);
  });
});

describe("report summaries", () => {
  const report = buildSummaryReport({ insight, safety, safetyApprovals: approvals, coach });

  it("lists the sections that have content", () => {
    expect(reportSections(report)).toEqual(["insights", "safety", "recommendations", "research"]);
    // A safety review that found nothing still gets its section.
    const clear = buildSummaryReport({ safety: JSON.stringify({ risks: [], clear_stages: ["Booking"] }) });
    expect(reportSections(clear)).toEqual(["safety"]);
  });

  it("gives one headline number per step", () => {
    expect(reportStats(report).map((s) => [s.label, s.value, s.detail])).toEqual([
      ["Themes", 3, "1 pain point · 1 working well · 1 observation"],
      ["Journey stages", null, "Not run yet"],
      ["Safety risks", 2, "1 approved · 1 to review"],
      ["Recommendations", 2, "1 next step"],
    ]);
  });

  it("describes each section in one line", () => {
    expect(sectionMeta(report, "insights")).toBe("3 themes · 3 participants");
    expect(sectionMeta(report, "safety")).toBe("2 risks · 1 approved · 1 to review · 1 dismissed");
    expect(sectionMeta(report, "recommendations")).toBe("2 recommendations · 1 next step");
    expect(sectionMeta(report, "research")).toBe("1 open question");
    const journey = buildSummaryReport({ journey: JSON.stringify({ stages: [{ stage_name: "Booking" }] }) });
    expect(sectionMeta(journey, "journey")).toBe("1 stage · no friction");
  });
});
