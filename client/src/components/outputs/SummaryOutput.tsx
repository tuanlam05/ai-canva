import { useMemo, type CSSProperties, type ReactNode } from "react";
import { AlertIcon, BoxIcon, DownloadIcon } from "../ui/icons";
import { STEP_STYLE, TONE_COLOR, plural } from "../../lib/nodeView";
import { buildSummaryPdf } from "../../lib/summaryPdf";
import {
  buildSummaryReport,
  reportSections,
  reportStats,
  sectionMeta,
  type ReportStep,
  type Sentiment,
  type SummaryReport,
} from "../../lib/summaryReport";
import { useBoardStore } from "../../store/boardStore";
import type { BoxType } from "../../types";

/**
 * The summary report, built live from the latest output of each pipeline box
 * on the board (read by type, as in Alessio's summary) and the decisions made
 * in Safety Risk Review. There is nothing to run. Shared by the node header
 * (section count) and the body below.
 */
export function useSummaryReport(enabled = true): SummaryReport {
  const nodes = useBoardStore((state) => state.nodes);
  const boxData = useBoardStore((state) => state.boxData);

  return useMemo(() => {
    // Only the summary box needs this; other boxes skip the parsing.
    if (!enabled) return buildSummaryReport({});

    const dataFor = (type: BoxType) => {
      const node = nodes.find((candidate) => candidate.type === type);
      return node ? boxData[node.id] : undefined;
    };
    const safety = dataFor("safety");

    return buildSummaryReport({
      insight: dataFor("insight")?.output,
      journey: dataFor("journey")?.output,
      safety: safety?.output,
      safetyApprovals: safety?.approvals,
      coach: dataFor("coach")?.output,
    });
  }, [nodes, boxData, enabled]);
}

const SENTIMENT: Record<Sentiment, { label: string; className: string }> = {
  negative: { label: "Pain point", className: "chip-red" },
  positive: { label: "Works well", className: "chip-insight" },
  neutral: { label: "Observation", className: "chip-low" },
};

const rank = (index: number) => String(index + 1).padStart(2, "0");

/** The step's tile, as in the node header of that pipeline box. */
function StepTile({ step, size }: { step: ReportStep; size: "sm" | "md" }) {
  return (
    <span
      className={
        "node-tile " + (size === "sm" ? "!w-5 !h-5 !rounded-[6px]" : "!w-7 !h-7 !rounded-[8px]")
      }
      style={{ "--tile-color": STEP_STYLE[step]?.color } as CSSProperties}
      aria-hidden
    >
      <BoxIcon type={step} size={size === "sm" ? 11 : 14} />
    </span>
  );
}

function Section({
  step,
  title,
  meta,
  children,
}: {
  step: ReportStep;
  title: string;
  meta: string;
  children: ReactNode;
}) {
  return (
    <section className="pt-3.5 border-t border-line-divider">
      <div className="flex items-center gap-2.5 mb-2">
        <StepTile step={step} size="md" />
        <h3 className="m-0 text-[14px] leading-[1.25] font-semibold text-ink">{title}</h3>
        <span className="ml-auto min-w-0 truncate text-[12px] text-ink-muted">{meta}</span>
      </div>
      {children}
    </section>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <ul className="m-0 p-0 list-none flex flex-col">{children}</ul>;
}

function ResearchNext({ report }: { report: SummaryReport }) {
  return (
    <Rows>
      {report.researchNext.map((item, index) => (
        <li key={index} className="flex gap-2.5 items-start py-1.5">
          <span
            className="mt-[3px] w-3.5 h-3.5 flex-none rounded-[4px] border-[1.5px] border-[color:var(--edge-waiting)]"
            aria-hidden
          />
          <span className="min-w-0 text-[13px] leading-[1.45] text-ink-2 [text-wrap:pretty]">
            {item.question}
          </span>
        </li>
      ))}
    </Rows>
  );
}

type SummaryNodeProps = {
  report: SummaryReport;
};

/**
 * PDF Summary body: the report as a small dashboard — one headline number
 * per pipeline step, then a section per step, headed by that box's tile. The
 * downloaded PDF has the full detail. The node shell (tile, title, status,
 * ⋯ menu with Delete) comes from BoxNode.
 */
export default function SummaryNode({ report }: SummaryNodeProps) {
  const sections = reportSections(report);

  const handleDownload = () => {
    if (sections.length === 0) {
      return;
    }

    const { boardTitle } = useBoardStore.getState();
    const project = boardTitle.trim() === "Untitled Board" ? "" : boardTitle.trim();
    buildSummaryPdf(report, { project }).save("research-summary.pdf");
  };

  if (sections.length === 0) {
    return (
      <div className="px-7 py-10 flex flex-col items-center gap-3.5 text-center">
        <p className="m-0 text-[14px] font-semibold text-ink">No findings yet</p>
        <p className="m-0 max-w-[300px] text-[13.5px] leading-[1.55] text-ink-3 [text-wrap:pretty]">
          Run your research pipeline to populate the summary.
        </p>
      </div>
    );
  }

  const themes = report.themes ?? [];
  const risks = report.risks ?? [];

  return (
    <div className="nowheel px-4 pt-3.5 pb-4 flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="mono-label">Latest findings from your research pipeline</span>
        <button
          type="button"
          onClick={handleDownload}
          className="btn btn-secondary btn-sm nodrag flex-none"
          title="Download PDF"
        >
          <DownloadIcon /> Download PDF
        </button>
      </div>

      {/* Headline numbers, one per pipeline step: 2×2 at the default box
          width, one row when the box is widened. */}
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {reportStats(report).map((stat) => (
          <div
            key={stat.step}
            className="min-w-0 rounded-[10px] border border-line-soft bg-surface px-3 pt-2.5 pb-3"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <StepTile step={stat.step} size="sm" />
              <span className="truncate text-[12px] font-medium text-ink-3">{stat.label}</span>
            </div>
            <div
              className={
                "mt-2 text-[24px] leading-none font-semibold tabular-nums " +
                (stat.value === null ? "text-ink-icon" : "text-ink")
              }
            >
              {stat.value ?? "–"}
            </div>
            <div className="mt-1.5 text-[11.5px] leading-[1.35] text-ink-muted line-clamp-2">
              {stat.detail}
            </div>
          </div>
        ))}
      </div>

      {sections.includes("insights") && (
        <Section step="insight" title="Key insights" meta={sectionMeta(report, "insights")}>
          <Rows>
            {themes.map((theme, index) => (
              <li key={index} className="flex items-center gap-2.5 py-1.5">
                <span className="w-5 flex-none font-mono text-[11px] text-ink-icon">{rank(index)}</span>
                <span className="flex-1 min-w-0 text-[13px] leading-[1.4] font-medium text-ink [text-wrap:pretty]">
                  {theme.name}
                </span>
                <span className={"chip " + SENTIMENT[theme.sentiment].className}>
                  {SENTIMENT[theme.sentiment].label}
                </span>
                <span className="w-[62px] flex-none text-right font-mono text-[11px] text-ink-muted">
                  {plural(theme.quotes, "quote")}
                </span>
              </li>
            ))}
          </Rows>
        </Section>
      )}

      {sections.includes("journey") && (
        <Section step="journey" title="User journey" meta={sectionMeta(report, "journey")}>
          <Rows>
            {(report.stages ?? []).map((stage, index) => (
              <li key={index} className="flex items-center gap-2.5 py-1.5">
                <span className="w-5 flex-none font-mono text-[11px] text-ink-icon">{rank(index)}</span>
                <span
                  className="w-2 h-2 flex-none rounded-full"
                  style={{ background: TONE_COLOR[stage.tone] }}
                  title={stage.tone}
                  aria-hidden
                />
                <span className="flex-1 min-w-0 text-[13px] leading-[1.4] font-medium text-ink [text-wrap:pretty]">
                  {stage.name}
                </span>
                {stage.friction && (
                  <span className="chip chip-red">
                    <AlertIcon size={11} strokeWidth={2.2} />
                    Friction
                  </span>
                )}
                {stage.emotion && (
                  <span className="w-[84px] flex-none text-right font-mono text-[10.5px] tracking-[.05em] uppercase text-ink-3 truncate">
                    {stage.emotion}
                  </span>
                )}
              </li>
            ))}
          </Rows>
        </Section>
      )}

      {sections.includes("safety") && (
        <Section step="safety" title="Safety risks" meta={sectionMeta(report, "safety")}>
          {risks.length === 0 && (
            <p className="m-0 mb-1 px-3 py-2 rounded-lg bg-surface-sunken text-[12.5px] text-ink-3">
              {report.dismissedRisks
                ? "Every flagged risk was dismissed in review."
                : "No safety risks were flagged."}
            </p>
          )}
          <Rows>
            {risks.map((risk, index) => (
              <li key={index} className="flex gap-2.5 items-start py-1.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] leading-[1.4] font-semibold text-ink [text-wrap:pretty]">
                    {risk.summary}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {risk.category && <span className="chip chip-red">{risk.category}</span>}
                    {risk.stage && (
                      <span className="chip chip-violet !h-5 !text-[11.5px]">{risk.stage}</span>
                    )}
                  </div>
                </div>
                {risk.approved ? (
                  <span className="flex-none mt-0.5 font-mono text-[11px] font-semibold text-[color:var(--step-safety)]">
                    Approved
                  </span>
                ) : (
                  <span className="status-pill is-review">To review</span>
                )}
              </li>
            ))}
          </Rows>
          {report.clearStages.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted">
              No concerns found at
              {report.clearStages.map((stage) => (
                <span key={stage} className="chip chip-violet !h-5 !text-[11.5px]">
                  {stage}
                </span>
              ))}
            </div>
          )}
        </Section>
      )}

      {sections.includes("recommendations") && (
        <Section
          step="coach"
          title="Recommendations"
          meta={sectionMeta(report, "recommendations")}
        >
          <Rows>
            {(report.recommendations ?? []).map((recommendation, index) => (
              <li key={index} className="flex gap-2.5 items-start py-1.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] leading-[1.4] font-semibold text-ink [text-wrap:pretty]">
                    {recommendation.title}
                  </div>
                  {recommendation.category && (
                    <div className="mt-0.5 text-[12px] text-ink-muted">
                      Responds to · {recommendation.category}
                    </div>
                  )}
                </div>
                <span className="flex-none mt-0.5 font-mono text-[11px] text-ink-muted">
                  {plural(recommendation.steps.length, "step")}
                </span>
              </li>
            ))}
          </Rows>
          {sections.includes("research") && (
            <>
              <div className="mt-3 mb-1 flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-ink">Research next</span>
                <span className="text-[12px] text-ink-muted">{sectionMeta(report, "research")}</span>
              </div>
              <ResearchNext report={report} />
            </>
          )}
        </Section>
      )}

      {sections.includes("research") && !sections.includes("recommendations") && (
        <Section step="coach" title="Research next" meta={sectionMeta(report, "research")}>
          <ResearchNext report={report} />
        </Section>
      )}
    </div>
  );
}
