import { useEffect, useId, useRef, useState } from "react";
import {
  contiguousRuns,
  emotionScore,
  smoothPath,
  stageHasFriction,
  stageTone,
  TONE_COLOR,
} from "../../lib/nodeView";
import { AlertIcon, CaretIcon } from "../ui/icons";

interface Evidence {
  quote: string;
  source: string;
}

interface Issue {
  theme_id: string;
  theme: string;
  description: string;
  sentiment: "positive" | "negative" | "neutral";
  evidence: Evidence[];
}

interface Stage {
  stage_name: string;
  stage_description: string;
  emotion: string;
  issues: Issue[];
}

interface JourneyMapperOutputProps {
  content: string;
}

const SENTIMENT_LABEL: Record<string, string> = {
  negative: "Pain point",
  positive: "Works well",
  neutral: "Observation",
};

/**
 * Chart geometry. The chart always fits the box width (measured, so the
 * viewBox is 1:1 with screen pixels and text never scales) — no sideways
 * scrolling. CHART_MIN_W is only the size used before the first measure.
 */
const CHART_MIN_W = 468;
const CHART_H = 168;
/**
 * Below this width per stage the labels switch to a compact form: number +
 * two-line name, with the emotion word moved to the tooltip (it's also in
 * the stage list underneath).
 */
const COMPACT_STAGE_W = 100;

/* Points are coloured by stage tone (TONE_COLOR). Friction (any negative
   theme) is red on the band and the stage labels. */
const PAD_TOP = 26;
const PAD_BOTTOM = 30;

export default function JourneyMapperOutput({
  content,
}: JourneyMapperOutputProps) {
  // Accordion over the stage list; every stage starts closed.
  const [openStage, setOpenStage] = useState<number | null>(null);
  // Unique gradient id — several Journey boxes can share one page.
  const gradientId = "jmfill-" + useId().replace(/:/g, "");
  // Chart width follows the box (resizing the box re-lays the chart out).
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(CHART_MIN_W);
  useEffect(() => {
    const el = chartRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setChartW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [content]);

  let stages: Stage[] = [];
  let parseError = false;

  try {
    const parsed = JSON.parse(content);
    stages = Array.isArray(parsed.stages) ? parsed.stages : [];
  } catch {
    parseError = true;
  }

  if (parseError) {
    return (
      <div className="m-3 p-3 rounded-lg bg-[color:var(--amber-bg)] text-[color:var(--amber-text)] text-[13px]">
        <span className="flex items-center gap-1.5 font-semibold">
          <AlertIcon /> Could not parse structured output. Showing raw text below.
        </span>
        <pre className="mt-2 whitespace-pre-wrap font-mono text-[11.5px] leading-5 text-ink-3">
          {content}
        </pre>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="text-ink-muted text-[13px] py-8 text-center">
        No journey stages found.
      </div>
    );
  }

  const n = stages.length;
  const friction = stages.map(stageHasFriction);
  const tones = stages.map(stageTone);
  const frictionCount = friction.filter(Boolean).length;
  const bands = contiguousRuns(friction);
  const CHART_W = chartW;
  const colW = CHART_W / n;
  const compact = colW < COMPACT_STAGE_W;
  const usable = CHART_H - PAD_TOP - PAD_BOTTOM;
  const points: [number, number][] = stages.map((s, i) => [
    colW * i + colW / 2,
    PAD_TOP + ((100 - emotionScore(s.emotion, s.issues ?? [])) / 100) * usable,
  ]);
  const lowest = points.reduce((lo, p, i) => (p[1] > points[lo][1] ? i : lo), 0);
  const line = smoothPath(points);
  const area =
    n > 1
      ? `${line} L${points[n - 1][0].toFixed(1)} ${CHART_H} L${points[0][0].toFixed(1)} ${CHART_H} Z`
      : "";
  const pct = (x: number) => `${(x * 100) / n}%`;

  return (
    <div className="nowheel px-4 pt-3.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="mono-label">Emotion by stage</span>
        <span className="font-mono text-[10.5px] text-ink-faint">↑ more positive</span>
      </div>

      <div ref={chartRef} className="relative">
        {/* Friction band(s): one per run of contiguous friction stages,
          from the chart top through the stage labels. */}
        {bands.map(([a, b], k) => (
          <div
            key={`band-${a}`}
            className="chart-band absolute top-0 bottom-0 rounded-t-lg bg-[color:var(--red-band)]"
            style={{ left: pct(a), width: pct(b - a + 1) }}
          >
            {k === 0 && (
              <div className="absolute left-0 top-2 pl-2.5 flex items-center gap-[5px] font-mono text-[10.5px] font-semibold tracking-[.06em] uppercase text-[color:var(--red-text)] whitespace-nowrap">
                <AlertIcon />
                Friction · {frictionCount}
                {compact ? "" : frictionCount === 1 ? " stage" : " stages"}
              </div>
            )}
          </div>
        ))}

        <svg
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          className="relative block w-full h-auto overflow-visible"
          role="img"
          aria-label="Emotion by journey stage"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--step-journey)" stopOpacity="0.16" />
              <stop offset="1" stopColor="var(--step-journey)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Faint guides: top (most positive), middle and baseline. */}
          {[0, 0.5, 1].map((f) => (
            <line
              key={f}
              x1={0}
              x2={CHART_W}
              y1={PAD_TOP + usable * f}
              y2={PAD_TOP + usable * f}
              stroke="var(--divider-soft)"
              strokeWidth={1}
              strokeDasharray={f === 1 ? undefined : "3 4"}
            />
          ))}
          {/* A dotted drop line from each point to its stage label below. */}
          {points.map(([x, y], i) => (
            <line
              key={`drop-${i}`}
              x1={x}
              x2={x}
              y1={y + 7}
              y2={CHART_H}
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray="1.5 3.5"
            />
          ))}
          {area && <path className="chart-area" d={area} fill={`url(#${gradientId})`} />}
          <path
            className="chart-line"
            pathLength={1}
            d={line}
            fill="none"
            stroke="var(--step-journey)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* One point per stage, coloured by the stage's tone (negative =
              red, mixed = yellow, otherwise the step colour). They pop in
              one after another as the line draws; the lowest is larger. */}
          {points.map(([x, y], i) => (
            <circle
              key={i}
              className="chart-point"
              style={{ animationDelay: `${0.2 + (i / Math.max(1, n - 1)) * 0.7}s` }}
              cx={x}
              cy={y}
              r={i === lowest ? 6.5 : 5.5}
              fill={TONE_COLOR[tones[i]]}
              stroke="var(--surface)"
              strokeWidth={2}
            >
              <title>
                {`${stages[i].stage_name}${stages[i].emotion ? ` — ${stages[i].emotion}` : ""} (${tones[i]})`}
              </title>
            </circle>
          ))}
          {/* "Lowest point" as a small pill: below the point when there's
              room, otherwise above it; kept inside the chart at the edges. */}
          {n > 1 &&
            (() => {
              const [px, py] = points[lowest];
              const w = 84;
              const h = 18;
              const cx = Math.min(Math.max(px, w / 2 + 2), CHART_W - w / 2 - 2);
              const top = py + 12 + h <= CHART_H - 2 ? py + 12 : py - 12 - h;
              return (
                <g className="chart-area" style={{ animationDelay: "0.9s" }}>
                  <rect
                    x={cx - w / 2}
                    y={top}
                    width={w}
                    height={h}
                    rx={h / 2}
                    fill="var(--surface)"
                    stroke="var(--divider-soft)"
                  />
                  <text
                    x={cx}
                    y={top + h / 2 + 3.5}
                    textAnchor="middle"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fill: "var(--meta-text)" }}
                  >
                    Lowest point
                  </text>
                </g>
              );
            })()}
        </svg>

        <div
          className="relative grid border-t border-line-soft"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {stages.map((stage, i) => (
            <div
              key={i}
              className={
                "pt-2.5 pb-3.5 flex flex-col items-center text-center min-w-0 " +
                (compact ? "px-1 gap-1" : "px-1.5 gap-[5px]")
              }
              title={
                stage.stage_name +
                (stage.emotion ? ` — ${stage.emotion}` : "") +
                (friction[i] ? " (friction)" : "")
              }
            >
              <span className="font-mono text-[10.5px] text-ink-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={
                  "font-semibold break-words line-clamp-2 " +
                  (compact ? "text-[11.5px] leading-[1.25] " : "text-[12.5px] leading-[1.3] ") +
                  (friction[i] ? "text-[color:var(--red-text)]" : "text-ink")
                }
              >
                {stage.stage_name}
              </span>
              {stage.emotion && !compact && (
                <span className="font-mono text-[10.5px] tracking-[.05em] uppercase text-ink-3 break-words line-clamp-2">
                  {stage.emotion}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend for the point and label colours. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] text-ink-muted">
        {[
          { c: "var(--red-text)", l: "Negative" },
          { c: "var(--amber-dot)", l: "Mixed" },
          { c: "var(--step-journey)", l: "Positive / neutral" },
        ].map((k) => (
          <span key={k.l} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: k.c }} aria-hidden />
            {k.l}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[3px] bg-[color:var(--red-band)] border border-[color:var(--red-border)]" aria-hidden />
          Friction
        </span>
      </div>

      {/* Stage list — the existing expandable detail, one card per stage. */}
      <div className="mt-3.5 -mx-1 pb-3 flex flex-col gap-1.5">
        {stages.map((stage, i) => {
          const isOpen = openStage === i;
          const issues = stage.issues ?? [];

          return (
            <div key={i} className={"acc-row" + (isOpen ? " is-open" : "")}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenStage(isOpen ? null : i)}
                className="acc-head nodrag"
              >
                <CaretIcon className={"caret" + (isOpen ? " is-open" : "")} />
                <span
                  className="w-2 h-2 flex-none rounded-full"
                  style={{ background: TONE_COLOR[tones[i]] }}
                  title={tones[i]}
                  aria-hidden
                />
                <span className="flex-1 min-w-0 text-[13.5px] font-semibold text-ink truncate">
                  {i + 1}. {stage.stage_name}
                </span>
                {friction[i] && (
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
              </button>

              {isOpen && (
                <div className="pl-[35px] pr-3 pt-0.5 pb-3 flex flex-col gap-2.5 anim-fade-up">
                  <p className="m-0 text-[13px] leading-[1.5] text-ink-2 [text-wrap:pretty]">
                    {stage.stage_description}
                  </p>

                  {issues.length === 0 && (
                    <div className="text-[12.5px] text-ink-muted bg-surface-sunken rounded-lg px-3 py-2.5">
                      No research evidence found for this stage.
                    </div>
                  )}

                  {issues.map((issue, j) => (
                    <div
                      key={issue.theme_id || j}
                      className="border border-line-soft rounded-lg px-3 py-2.5 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="mono-label">Linked theme</span>
                        {issue.sentiment && (
                          <span
                            className={
                              "font-mono text-[10.5px] tracking-[.04em] uppercase " +
                              (issue.sentiment === "negative"
                                ? "text-[color:var(--red-text)] font-semibold"
                                : "text-ink-faint")
                            }
                          >
                            {SENTIMENT_LABEL[issue.sentiment] ?? issue.sentiment}
                          </span>
                        )}
                      </div>
                      <span className="text-[13px] font-semibold text-ink">
                        {issue.theme}
                      </span>
                      <p className="m-0 text-[12.5px] leading-[1.5] text-ink-2 [text-wrap:pretty]">
                        {issue.description}
                      </p>

                      {issue.evidence?.map((ev, k) => (
                        <div key={k} className="quote-box">
                          <span>&ldquo;{ev.quote}&rdquo;</span>
                          <div className="flex justify-between items-center gap-2">
                            <span className="text-[12px] text-[color:var(--meta-text)]">
                              — {ev.source}
                            </span>
                            <span className="font-mono text-[10px] tracking-[.06em] text-ink-icon">
                              READ-ONLY
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
