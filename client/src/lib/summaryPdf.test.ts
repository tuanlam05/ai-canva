import { describe, expect, it } from "vitest";
import { buildSummaryPdf, toPdfText } from "./summaryPdf";
import { buildSummaryReport } from "./summaryReport";

describe("toPdfText", () => {
  it("maps typographic characters to Latin-1", () => {
    expect(toPdfText("“Quote” — it’s fine…")).toBe('"Quote" - it\'s fine...');
  });

  it("drops characters Helvetica cannot draw", () => {
    expect(toPdfText("Great 🎉 result  ✓")).toBe("Great result");
  });

  it("keeps plain text and turns unusual spaces into normal ones", () => {
    expect(toPdfText("Plain text, stays as-is")).toBe("Plain text, stays as-is");
    expect(toPdfText("non breaking thin space")).toBe("non breaking thin space");
  });
});

const outputs = {
  insight: JSON.stringify({
    themes: [
      {
        theme: "Referral status is invisible",
        description: "Patients cannot see where a referral is.",
        sentiment: "negative",
        evidence: [{ quote: "q", source: "Participant P3" }],
      },
    ],
  }),
  journey: JSON.stringify({
    stages: [
      { stage_name: "Booking", stage_description: "Books online.", emotion: "Confident", issues: [] },
      {
        stage_name: "Referral",
        stage_description: "Waits to hear back.",
        emotion: "Frustrated",
        issues: [{ sentiment: "negative" }],
      },
    ],
  }),
  safety: JSON.stringify({
    risks: [
      { id: "risk-1", category: "Access Risk", summary: "Referral can go missing", stage: "Referral", reason: "r" },
      { id: "risk-2", category: "Communication Risk", summary: "Dismissed concern", stage: "Booking", reason: "r" },
    ],
    clear_stages: ["Booking"],
  }),
  safetyApprovals: { "risk-2": { status: "dismissed" as const, by: "a", at: 1 } },
  coach: JSON.stringify({
    guidance: [{ risk_id: "risk-1", plain_summary: "Confirm when a referral is sent", next_steps: ["Send a confirmation"] }],
    research_next: [{ question: "Where do referrals stall?" }],
  }),
};

describe("buildSummaryPdf", () => {
  it("draws every section of the report", () => {
    const pdf = buildSummaryPdf(buildSummaryReport(outputs), {
      date: new Date(2026, 0, 1),
      project: "Clinic study",
    });
    const text = pdf.output();
    expect(text).toContain("(Clinic study · Evidence from 1 participant)");
    for (const expected of [
      "Research Summary",
      "Key insights",
      "Referral status is invisible",
      "User journey",
      "Safety risks",
      "Referral can go missing",
      "Recommendations",
      "Send a confirmation",
      "Research next",
      "Where do referrals stall?",
    ]) {
      expect(text).toContain(`(${expected})`);
    }
    // Dismissed in review, so left out.
    expect(text).not.toContain("Dismissed concern");
    // Themes count their supporting quotes.
    expect(text).toContain("(QUOTES)");
    expect(text).not.toContain("MENTIONS");
  });

  it("paginates long reports", () => {
    const long = "word ".repeat(60).trim();
    const themes = Array.from({ length: 40 }, (_, i) => ({
      theme: `Theme ${i}`,
      description: long,
      sentiment: "neutral",
      evidence: [],
    }));
    const pdf = buildSummaryPdf(buildSummaryReport({ insight: JSON.stringify({ themes }) }));
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
  });
});
