import type { ItemApproval } from "../types.js";
import { emotionScore, plural, sourceCode, stageHasFriction, stageTone } from "./nodeView.js";

/**
 * The PDF Summary's content: the latest output of each research pipeline box
 * (read by type), reshaped into one report. The summary box on the canvas
 * and the PDF it downloads both render this, so they always agree. Pure — it
 * only reads the outputs.
 *
 * Researcher decisions apply as they do in the pipeline: a risk dismissed in
 * Safety Risk Review is left out, and so is the advice responding to it (as
 * in UX Recommendations).
 */

export type Sentiment = "negative" | "positive" | "neutral";

export interface ReportTheme {
  name: string;
  description: string;
  sentiment: Sentiment;
  /** How many participant quotes support the theme. */
  quotes: number;
}

export interface ReportStage {
  name: string;
  description: string;
  emotion: string;
  /** 0–100, higher is more positive (see emotionScore). */
  score: number;
  tone: ReturnType<typeof stageTone>;
  friction: boolean;
}

export interface ReportRisk {
  summary: string;
  category: string;
  stage: string;
  reason: string;
  /** Approved in Safety Risk Review; false while it still needs a decision. */
  approved: boolean;
}

export interface ReportRecommendation {
  title: string;
  why: string;
  stage: string;
  /** Category of the risk it responds to ("" when that risk isn't found). */
  category: string;
  steps: string[];
}

export interface ReportQuestion {
  question: string;
  why: string;
}

export interface SummaryReport {
  /** Each list is null while its box has no readable output. */
  themes: ReportTheme[] | null;
  /** Participants ("P1", …) or other sources quoted as theme evidence. */
  sources: string[];
  stages: ReportStage[] | null;
  risks: ReportRisk[] | null;
  /** Risks dismissed in review, which `risks` leaves out. */
  dismissedRisks: number;
  /** Stages the safety review checked and found no concern in. */
  clearStages: string[];
  recommendations: ReportRecommendation[] | null;
  researchNext: ReportQuestion[];
}

export interface PipelineOutputs {
  insight?: string;
  journey?: string;
  safety?: string;
  /** Researcher decisions on the safety risks, keyed by risk id. */
  safetyApprovals?: Record<string, ItemApproval>;
  coach?: string;
}

function parse(output: string | undefined): any {
  if (!output?.trim()) return null;
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

/** Trimmed text, or "" for anything that isn't a string. */
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function items(value: unknown): any[] {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

export function buildSummaryReport(outputs: PipelineOutputs): SummaryReport {
  const insight = parse(outputs.insight);
  const journey = parse(outputs.journey);
  const safety = parse(outputs.safety);
  const coach = parse(outputs.coach);
  const approvals = outputs.safetyApprovals ?? {};
  const isDismissed = (id: unknown) =>
    !!text(id) && approvals[text(id)]?.status === "dismissed";

  // Themes, ranked by supporting quotes like the Theme Finder box.
  const themes = Array.isArray(insight?.themes)
    ? items(insight.themes)
        .map((theme, index) => {
          const sentiment = text(theme.sentiment).toLowerCase();
          return {
            name: text(theme.theme),
            description: text(theme.description),
            sentiment: (sentiment === "negative" || sentiment === "positive"
              ? sentiment
              : "neutral") as Sentiment,
            quotes: items(theme.evidence).length,
            index,
          };
        })
        .filter((theme) => theme.name || theme.description)
        .sort((a, b) => b.quotes - a.quotes || a.index - b.index)
        .map(({ index: _index, ...theme }) => ({ ...theme, name: theme.name || "Untitled theme" }))
    : null;

  const sources = [
    ...new Set(
      items(insight?.themes)
        .flatMap((theme) => items(theme.evidence))
        .map((evidence) => text(evidence.source))
        .filter(Boolean)
        .map(sourceCode),
    ),
  ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const stages = Array.isArray(journey?.stages)
    ? items(journey.stages)
        .filter((stage) => text(stage.stage_name) || text(stage.stage_description))
        .map((stage) => {
          const issues = items(stage.issues);
          const emotion = text(stage.emotion);
          return {
            name: text(stage.stage_name) || "Untitled stage",
            description: text(stage.stage_description),
            emotion,
            score: emotionScore(emotion, issues),
            tone: stageTone({ issues }),
            friction: stageHasFriction({ issues }),
          };
        })
    : null;

  const allRisks = items(safety?.risks);
  const risks = Array.isArray(safety?.risks)
    ? allRisks
        .filter((risk) => !isDismissed(risk.id))
        .map((risk) => ({
          summary: text(risk.summary) || text(risk.theme) || "Untitled risk",
          category: text(risk.category),
          stage: text(risk.stage),
          reason: text(risk.reason),
          approved: approvals[text(risk.id)]?.status === "approved",
        }))
    : null;

  const recommendations = Array.isArray(coach?.guidance)
    ? items(coach.guidance)
        .filter((guidance) => !isDismissed(guidance.risk_id))
        .map((guidance) => {
          const risk = allRisks.find(
            (candidate) => text(candidate.id) && text(candidate.id) === text(guidance.risk_id),
          );
          return {
            title: text(guidance.plain_summary),
            why: text(guidance.why_it_matters),
            stage: text(guidance.stage) || text(risk?.stage),
            category: text(risk?.category),
            steps: (Array.isArray(guidance.next_steps) ? guidance.next_steps : [])
              .map(text)
              .filter(Boolean),
          };
        })
        .filter((recommendation) => recommendation.title || recommendation.steps.length)
        .map((recommendation) => ({
          ...recommendation,
          title: recommendation.title || "Recommendation",
        }))
    : null;

  return {
    themes,
    sources,
    stages,
    risks,
    dismissedRisks: allRisks.filter((risk) => isDismissed(risk.id)).length,
    clearStages: (Array.isArray(safety?.clear_stages) ? safety.clear_stages : [])
      .map(text)
      .filter(Boolean),
    recommendations,
    researchNext: items(coach?.research_next)
      .map((item) => ({ question: text(item.question), why: text(item.why) }))
      .filter((item) => item.question),
  };
}

export type ReportSection = "insights" | "journey" | "safety" | "recommendations" | "research";

/** The sections the report has content for, in report order. */
export function reportSections(report: SummaryReport): ReportSection[] {
  const sections: ReportSection[] = [];
  if (report.themes?.length) sections.push("insights");
  if (report.stages?.length) sections.push("journey");
  if (report.risks && (report.risks.length || report.clearStages.length || report.dismissedRisks)) {
    sections.push("safety");
  }
  if (report.recommendations?.length) sections.push("recommendations");
  if (report.researchNext.length) sections.push("research");
  return sections;
}

/** "4 participants", or "3 sources" when the evidence isn't P1–Pn transcripts. */
export function sourcesLabel(sources: string[]): string {
  return sources.every((source) => /^P\d+$/.test(source))
    ? plural(sources.length, "participant")
    : plural(sources.length, "source");
}

function sentimentBreakdown(themes: ReportTheme[]): string {
  const count = (sentiment: Sentiment) => themes.filter((t) => t.sentiment === sentiment).length;
  const parts: string[] = [];
  if (count("negative")) parts.push(plural(count("negative"), "pain point"));
  if (count("positive")) parts.push(`${count("positive")} working well`);
  if (count("neutral")) parts.push(plural(count("neutral"), "observation"));
  return parts.join(" · ") || "None found";
}

/** "friction in 3", or "no friction" when no stage has any. */
function frictionLabel(stages: ReportStage[]): string {
  const count = stages.filter((stage) => stage.friction).length;
  return count ? `friction in ${count}` : "no friction";
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function reviewBreakdown(report: SummaryReport): string {
  const risks = report.risks ?? [];
  if (risks.length === 0) return report.dismissedRisks ? "All dismissed in review" : "None flagged";
  const approved = risks.filter((risk) => risk.approved).length;
  const pending = risks.length - approved;
  if (pending === 0) return "All approved";
  return approved ? `${approved} approved · ${pending} to review` : `${pending} to review`;
}

export type ReportStep = "insight" | "journey" | "safety" | "coach";

export interface ReportStat {
  step: ReportStep;
  label: string;
  /** null while that step has no output yet. */
  value: number | null;
  detail: string;
}

/** The headline numbers: one tile per pipeline step. */
export function reportStats(report: SummaryReport): ReportStat[] {
  const { themes, stages, risks, recommendations } = report;
  const steps = (recommendations ?? []).reduce((sum, r) => sum + r.steps.length, 0);
  return [
    {
      step: "insight",
      label: "Themes",
      value: themes ? themes.length : null,
      detail: themes ? sentimentBreakdown(themes) : "Not run yet",
    },
    {
      step: "journey",
      label: "Journey stages",
      value: stages ? stages.length : null,
      detail: stages ? capitalize(frictionLabel(stages)) : "Not run yet",
    },
    {
      step: "safety",
      label: "Safety risks",
      value: risks ? risks.length : null,
      detail: risks ? reviewBreakdown(report) : "Not run yet",
    },
    {
      step: "coach",
      label: "Recommendations",
      value: recommendations ? recommendations.length : null,
      detail: recommendations
        ? recommendations.length
          ? plural(steps, "next step")
          : "None to show"
        : "Not run yet",
    },
  ];
}

/** One-line summary shown beside each section title. */
export function sectionMeta(report: SummaryReport, section: ReportSection): string {
  switch (section) {
    case "insights": {
      const themes = report.themes ?? [];
      const base = plural(themes.length, "theme");
      return report.sources.length ? `${base} · ${sourcesLabel(report.sources)}` : base;
    }
    case "journey": {
      const stages = report.stages ?? [];
      return `${plural(stages.length, "stage")} · ${frictionLabel(stages)}`;
    }
    case "safety": {
      const risks = report.risks ?? [];
      const parts = [plural(risks.length, "risk")];
      const approved = risks.filter((risk) => risk.approved).length;
      if (approved) parts.push(`${approved} approved`);
      if (risks.length - approved) parts.push(`${risks.length - approved} to review`);
      if (report.dismissedRisks) parts.push(`${report.dismissedRisks} dismissed`);
      return parts.join(" · ");
    }
    case "recommendations": {
      const recommendations = report.recommendations ?? [];
      const steps = recommendations.reduce((sum, r) => sum + r.steps.length, 0);
      return `${plural(recommendations.length, "recommendation")} · ${plural(steps, "next step")}`;
    }
    case "research":
      return plural(report.researchNext.length, "open question");
  }
}
