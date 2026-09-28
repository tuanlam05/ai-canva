import { useMemo } from "react";
import { jsPDF } from "jspdf";
import { useBoardStore } from "../../store/boardStore";

type BoxType = "insight" | "journey" | "safety" | "coach";

type InsightOutput = {
  themes?: Array<{
    theme?: string;
    description?: string;
  }>;
};

type JourneyOutput = {
  stages?: Array<{
    stage_name?: string;
    stage_description?: string;
  }>;
};

type SafetyOutput = {
  risks?: Array<{
    stage?: string;
    summary?: string;
  }>;
};

type CoachOutput = {
  guidance?: Array<{
    next_steps?: string[];
  }>;
  research_next?: Array<{
    question?: string;
  }>;
};

type SummarySection = {
  title: string;
  items: string[];
};

function trimText(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);

  if (words.length <= maxWords) {
    return text.trim();
  }

  return `${words.slice(0, maxWords).join(" ")}…`;
}

function parseOutput<T>(output: string): T | null {
  if (!output.trim()) {
    return null;
  }

  try {
    return JSON.parse(output) as T;
  } catch {
    return null;
  }
}

function buildSummary(
  insight: InsightOutput | null,
  journey: JourneyOutput | null,
  safety: SafetyOutput | null,
  coach: CoachOutput | null,
): SummarySection[] {
  const sections: SummarySection[] = [];

  if (insight?.themes?.length) {
    sections.push({
      title: "Key insights",
      items: insight.themes.slice(0, 8).map((theme) => {
        const name = trimText(theme.theme ?? "", 8);
        const description = trimText(theme.description ?? "", 24);

        return description ? `${name}: ${description}` : name;
      }),
    });
  }

  if (journey?.stages?.length) {
    sections.push({
      title: "User journey",
      items: journey.stages.slice(0, 8).map((stage) => {
        const name = stage.stage_name?.trim() ?? "";
        const description = trimText(stage.stage_description ?? "", 20);

        return description ? `${name}: ${description}` : name;
      }),
    });
  }

  if (safety?.risks?.length) {
    sections.push({
      title: "Safety considerations",
      items: safety.risks.slice(0, 8).map((risk) => {
        const stage = risk.stage?.trim() ?? "";
        const summary = trimText(risk.summary ?? "", 20);

        return stage ? `${stage}: ${summary}` : summary;
      }),
    });
  }

  if (coach?.guidance?.length) {
    const recommendations = coach.guidance
      .flatMap((guidance) => guidance.next_steps ?? [])
      .filter((step) => step.trim())
      .slice(0, 8)
      .map((step) => trimText(step, 18));

    if (recommendations.length) {
      sections.push({
        title: "Recommendations",
        items: recommendations,
      });
    }
  }

  if (coach?.research_next?.length) {
    const researchNext = coach.research_next
      .map((item) => item.question?.trim() ?? "")
      .filter(Boolean)
      .slice(0, 5)
      .map((question) => trimText(question, 20));

    if (researchNext.length) {
      sections.push({
        title: "Research next",
        items: researchNext,
      });
    }
  }

  return sections;
}

type SummaryNodeProps = {
  id: string;
  selected?: boolean;
};

export default function SummaryNode({ id, selected }: SummaryNodeProps) {
  const nodes = useBoardStore((state) => state.nodes);
  const boxData = useBoardStore((state) => state.boxData);
  const deleteBox = useBoardStore((state) => state.deleteBox);

  const sections = useMemo(() => {
    const getOutput = (type: BoxType): string => {
      const node = nodes.find((candidate) => candidate.type === type);

      if (!node) {
        return "";
      }

      return boxData[node.id]?.output ?? "";
    };

    const insight = parseOutput<InsightOutput>(getOutput("insight"));
    const journey = parseOutput<JourneyOutput>(getOutput("journey"));
    const safety = parseOutput<SafetyOutput>(getOutput("safety"));
    const coach = parseOutput<CoachOutput>(getOutput("coach"));

    return buildSummary(insight, journey, safety, coach);
  }, [nodes, boxData]);

  const handleDownload = () => {
    if (sections.length === 0) {
      return;
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    let y = 24;

    const addPageIfNeeded = (height: number) => {
      if (y + height > pageHeight - 20) {
        pdf.addPage();
        y = 24;
      }
    };

    // Header
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.setTextColor(15, 23, 42);

    pdf.text("Research Summary", margin, y);

    y += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);

    pdf.text("Latest findings from your research pipeline", margin, y);

    y += 12;

    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y, pageWidth - margin, y);

    y += 12;

    sections.forEach((section) => {
      addPageIfNeeded(20);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(100, 116, 139);

      pdf.text(section.title.toUpperCase(), margin, y);

      y += 7;

      section.items.forEach((item) => {
        const lines = pdf.splitTextToSize(item, contentWidth - 7);
        const itemHeight = lines.length * 5 + 4;

        addPageIfNeeded(itemHeight);

        pdf.setFillColor(148, 163, 184);
        pdf.circle(margin + 1.5, y - 1.5, 1.2, "F");

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10.5);
        pdf.setTextColor(51, 65, 85);

        pdf.text(lines, margin + 7, y);

        y += itemHeight;
      });

      y += 6;
    });

    // Footer / page numbers
    const pageCount = pdf.getNumberOfPages();

    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);

      pdf.text(
        `Research Summary • ${page} / ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        {
          align: "center",
        },
      );
    }

    pdf.save("research-summary.pdf");
  };

  return (
    <div
      className={[
        "relative h-full w-full overflow-hidden rounded-xl border bg-white shadow-sm",
        selected
          ? "border-amber-400 ring-2 ring-amber-100"
          : "border-slate-200",
      ].join(" ")}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-2xl">
            📄
          </div>

          <div className="min-w-0">
            <div className="text-base font-bold text-slate-900">
              PDF Summary
            </div>

            <div className="mt-0.5 text-sm text-slate-500">
              Latest findings from your research pipeline
            </div>
          </div>
        </div>

        <div className="nodrag nopan flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleDownload}
            disabled={sections.length === 0}
            title={
              sections.length === 0 ? "No findings to download" : "Download PDF"
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => deleteBox(id)}
            title="Delete PDF Summary"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="h-[calc(100%-81px)] overflow-y-auto px-6 py-5">
        {sections.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <div>
              <div className="mb-3 text-3xl">📄</div>

              <p className="text-base font-semibold text-slate-600">
                No findings yet
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Run your research pipeline to populate the summary.
              </p>
            </div>
          </div>
        ) : (
          <div>
            {sections.map((section) => (
              <section
                key={section.title}
                className="summary-section mb-7 last:mb-0"
              >
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  {section.title}
                </h3>

                <ul className="space-y-3">
                  {section.items.map((item, index) => (
                    <li
                      key={`${section.title}-${index}`}
                      className="flex gap-3 text-base leading-6 text-slate-700"
                    >
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-slate-400" />

                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
