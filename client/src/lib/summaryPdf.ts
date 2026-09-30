import { GState, jsPDF } from "jspdf";
import { contiguousRuns, smoothSegments, STEP_HEX } from "./nodeView";
import {
  reportSections,
  reportStats,
  sectionMeta,
  sourcesLabel,
  type ReportRecommendation,
  type ReportRisk,
  type ReportStage,
  type ReportStep,
  type ReportTheme,
  type Sentiment,
  type SummaryReport,
} from "./summaryReport";

/**
 * jsPDF's built-in Helvetica only covers Latin-1. A single character outside
 * it (curly quotes, "…", "—", emoji) makes jsPDF encode the whole string
 * differently and the line comes out garbled / letter-spaced. Map the common
 * typographic characters to plain equivalents and drop anything else.
 */
export function toPdfText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•●◦‣]/g, "-")
    .replace(/[  -​ ]/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA1-\xFF]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Millimetres per point. */
const PT = 25.4 / 72;
/** Cap height of Helvetica, as a fraction of the font size. */
const CAP = 0.72;

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
/** Where content starts on pages after the first. */
const PAGE_TOP = 18;
/** Where content stops; the footer sits below. */
const PAGE_BOTTOM = PAGE_H - 20;

/** Research-canvas design tokens (index.css), as hex for jsPDF. */
const COLOR = {
  ink: "#16181D",
  text2: "#3A3E46",
  text3: "#474B53",
  muted: "#626771",
  faint: "#6E737C",
  icon: "#8A8F98",
  waiting: "#B9BDC4",
  border: "#DCDFE4",
  divider: "#ECEEF1",
  dividerSoft: "#E4E7EB",
  sunken: "#F6F7F9",
  white: "#FFFFFF",
  redBg: "#F9E6E3",
  redBand: "#FCF0EE",
  redBorder: "#EDBDB6",
  redText: "#B02A22",
  amberBg: "#F8EDD2",
  amberText: "#7A5316",
  amberDot: "#DDA23A",
  violetBg: "#EEEBF8",
  violetText: "#4F3A99",
  greenBg: "#E3F3E6",
  lowBg: "#EDEFF2",
  lowText: "#565B64",
  /** Light text on the ink header band (the dark theme's text tokens). */
  onInk: "#FFFFFF",
  onInk2: "#B3B8BF",
  onInk3: "#8A8F98",
};

const STEP_ORDER: ReportStep[] = ["insight", "journey", "safety", "coach"];
const stepColor = (step: ReportStep) => STEP_HEX[step] ?? COLOR.ink;
const stepNumber = (step: ReportStep) => String(STEP_ORDER.indexOf(step) + 1);

/** `hex` mixed with white; `amount` is the share of the colour. */
function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) =>
    Math.round(c * amount + 255 * (1 - amount))
      .toString(16)
      .padStart(2, "0");
  return `#${mix(n >> 16)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

interface TextStyle {
  size: number;
  bold?: boolean;
  color?: string;
  /** Line height as a multiple of the size. */
  leading?: number;
  /** Letter spacing in mm, for uppercase labels. */
  tracking?: number;
}

/** The report's type scale. */
const TYPE = {
  overline: { size: 7.5, bold: true, color: COLOR.onInk3, tracking: 0.45 },
  title: { size: 26, bold: true, color: COLOR.onInk, leading: 1.1 },
  subtitle: { size: 10, color: COLOR.onInk2 },
  statLabel: { size: 6.5, bold: true, color: COLOR.text3, tracking: 0.25 },
  statValue: { size: 22, bold: true, leading: 1 },
  statDetail: { size: 7.3, color: COLOR.muted, leading: 1.3 },
  sectionTitle: { size: 15, bold: true },
  subsectionTitle: { size: 11.5, bold: true },
  sectionMeta: { size: 8, color: COLOR.muted },
  label: { size: 6.3, bold: true, color: COLOR.faint, tracking: 0.3 },
  rowTitle: { size: 9.8, bold: true },
  cardTitle: { size: 9.8, bold: true, leading: 1.3 },
  body: { size: 8.5, color: COLOR.text2, leading: 1.4 },
  bodyMuted: { size: 8.2, color: COLOR.muted, leading: 1.4 },
  small: { size: 7.3, color: COLOR.muted },
  footer: { size: 7, color: COLOR.muted },
} satisfies Record<string, TextStyle>;

const SENTIMENT_CHIP: Record<Sentiment, Chip> = {
  negative: { label: "Pain point", bg: COLOR.redBg, fg: COLOR.redText, caps: true },
  positive: {
    label: "Works well",
    bg: tint(stepColor("insight"), 0.12),
    fg: stepColor("insight"),
    caps: true,
  },
  neutral: { label: "Observation", bg: COLOR.lowBg, fg: COLOR.lowText, caps: true },
};

/** Point colour per stage tone, as on the Journey Flow chart (TONE_COLOR in nodeView). */
const TONE_COLOR: Record<ReportStage["tone"], string> = {
  negative: COLOR.redText,
  mixed: COLOR.amberDot,
  positive: stepColor("journey"),
  neutral: stepColor("journey"),
};

interface Chip {
  label: string;
  bg: string;
  fg: string;
  caps?: boolean;
}

/** A measured piece of layout: its height is known before it is drawn. */
interface Block {
  height: number;
  draw: (x: number, top: number, height: number) => void;
}

const CHIP_H = 4.8;
const CHIP_PAD = 1.7;
const CHIP_GAP = 1.4;
const CARD_GAP = 4;
const CARD_PAD = 3.6;
const ROW_PAD = 2.5;
const SECTION_GAP = 9;
const SECTION_HEAD_H = 8 + 6;

export interface SummaryPdfOptions {
  date?: Date;
  /** The board's name, shown under the report title. */
  project?: string;
}

/**
 * The research summary as a one-to-few page report: a title band, a row of
 * headline numbers (one per pipeline step), then a section per step in its
 * identity colour — ranked themes, the emotion curve across the journey,
 * safety risk cards, and recommendations with numbered next steps.
 */
export function buildSummaryPdf(
  report: SummaryReport,
  { date = new Date(), project = "" }: SummaryPdfOptions = {},
): jsPDF {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  pdf.setProperties({ title: project ? `Research Summary - ${toPdfText(project)}` : "Research Summary" });

  // ---- Text ---------------------------------------------------------------

  const use = (style: TextStyle) => {
    pdf.setFont("helvetica", style.bold ? "bold" : "normal");
    pdf.setFontSize(style.size);
    pdf.setTextColor(style.color ?? COLOR.ink);
    pdf.setCharSpace(style.tracking ?? 0);
  };
  const lineHeight = (style: TextStyle) => style.size * PT * (style.leading ?? 1.35);
  const capHeight = (style: TextStyle) => style.size * PT * CAP;

  const textWidth = (text: string, style: TextStyle) => {
    use(style);
    return pdf.getTextWidth(text) + (style.tracking ?? 0) * Math.max(0, text.length - 1);
  };

  /** Cuts `text` to `maxWidth`, ending it with "..." when it had to be cut. */
  const fit = (text: string, maxWidth: number, style: TextStyle, forceEllipsis = false) => {
    let out = toPdfText(text);
    if (!forceEllipsis && textWidth(out, style) <= maxWidth) return out;
    while (out.length > 1 && textWidth(`${out}...`, style) > maxWidth) out = out.slice(0, -1);
    return `${out.trimEnd()}...`;
  };

  /** Wraps `text` to `maxWidth`, keeping at most `maxLines` lines. */
  const wrap = (text: string, maxWidth: number, style: TextStyle, maxLines = 99): string[] => {
    const clean = toPdfText(text);
    if (!clean) return [];
    use(style);
    const lines: string[] = pdf.splitTextToSize(clean, maxWidth);
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = fit(kept[maxLines - 1], maxWidth, style, true);
    return kept;
  };

  /** Like wrap(), for "a · b · c" lists: breaks between items where it can. */
  const wrapList = (text: string, maxWidth: number, style: TextStyle, maxLines: number): string[] => {
    const lines: string[] = [];
    for (const item of text.split(" · ")) {
      const joined = lines.length ? `${lines[lines.length - 1]} · ${item}` : "";
      if (joined && textWidth(toPdfText(joined), style) <= maxWidth) lines[lines.length - 1] = joined;
      else lines.push(...wrap(item, maxWidth, style));
    }
    return wrap(lines.join("\n"), maxWidth, style, maxLines);
  };

  /** Draws text on a baseline; handles alignment itself so tracking is honoured. */
  const writeAt = (text: string, x: number, baseline: number, style: TextStyle, align: "left" | "center" | "right" = "left") => {
    const clean = toPdfText(text);
    const width = textWidth(clean, style);
    const left = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
    use(style);
    pdf.text(clean, left, baseline);
    pdf.setCharSpace(0);
  };

  /** Draws lines of text whose first line box starts at `top`; returns the height. */
  const write = (
    lines: string | string[],
    x: number,
    top: number,
    style: TextStyle,
    align: "left" | "center" | "right" = "left",
  ) => {
    const list = typeof lines === "string" ? [lines] : lines;
    const lh = lineHeight(style);
    list.forEach((line, i) => {
      writeAt(line, x, top + lh * i + (lh + capHeight(style)) / 2, style, align);
    });
    return list.length * lh;
  };

  // ---- Shapes -------------------------------------------------------------

  const fillRound = (x: number, top: number, w: number, h: number, r: number, fill: string) => {
    pdf.setFillColor(fill);
    pdf.roundedRect(x, top, w, h, r, r, "F");
  };

  const card = (x: number, top: number, w: number, h: number) => {
    pdf.setFillColor(COLOR.white);
    pdf.setDrawColor(COLOR.dividerSoft);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(x, top, w, h, 2.2, 2.2, "FD");
  };

  const rule = (top: number, color = COLOR.divider, x1 = MARGIN, x2 = PAGE_W - MARGIN) => {
    pdf.setDrawColor(color);
    pdf.setLineWidth(0.25);
    pdf.line(x1, top, x2, top);
  };

  /** The step's number on its identity colour; sections are numbered in pipeline order. */
  const stepTile = (step: ReportStep, x: number, top: number, size: number) => {
    fillRound(x, top, size, size, size * 0.24, stepColor(step));
    const style = { size: size * 1.3, bold: true, color: COLOR.white };
    writeAt(stepNumber(step), x + size / 2, top + (size + capHeight(style)) / 2, style, "center");
  };

  const chipStyle = (chip: Chip): TextStyle =>
    chip.caps
      ? { size: 6.2, bold: true, color: chip.fg, tracking: 0.25 }
      : { size: 7, bold: true, color: chip.fg };
  const chipLabel = (chip: Chip, maxWidth: number) =>
    fit(chip.caps ? chip.label.toUpperCase() : chip.label, maxWidth - CHIP_PAD * 2, chipStyle(chip));
  const chipWidth = (chip: Chip, maxWidth = CONTENT_W) =>
    textWidth(chipLabel(chip, maxWidth), chipStyle(chip)) + CHIP_PAD * 2;

  const drawChip = (chip: Chip, x: number, top: number, maxWidth = CONTENT_W) => {
    const width = chipWidth(chip, maxWidth);
    fillRound(x, top, width, CHIP_H, 1.1, chip.bg);
    writeAt(chipLabel(chip, maxWidth), x + CHIP_PAD, top + (CHIP_H + capHeight(chipStyle(chip))) / 2, chipStyle(chip));
    return width;
  };

  /** Lays chips out left to right, wrapping at `maxWidth`; returns the height. */
  const chipFlow = (chips: Chip[], maxWidth: number, at?: { x: number; top: number }) => {
    let x = 0;
    let row = 0;
    for (const chip of chips) {
      const width = Math.min(chipWidth(chip, maxWidth), maxWidth);
      if (x > 0 && x + width > maxWidth) {
        x = 0;
        row += 1;
      }
      if (at) drawChip(chip, at.x + x, at.top + row * (CHIP_H + CHIP_GAP), maxWidth);
      x += width + CHIP_GAP;
    }
    return chips.length ? (row + 1) * CHIP_H + row * CHIP_GAP : 0;
  };

  // ---- Flow ---------------------------------------------------------------

  let y = 0;
  const newPage = () => {
    pdf.addPage();
    y = PAGE_TOP;
  };
  /** Moves to a new page unless `height` still fits on this one. */
  const ensure = (height: number) => {
    if (y + height > PAGE_BOTTOM && y > PAGE_TOP) newPage();
  };

  /** A section title, kept on the same page as the block that follows it. */
  const sectionHead = (step: ReportStep, title: string, meta: string, firstBlock: number) => {
    if (y > PAGE_TOP) y += SECTION_GAP;
    ensure(SECTION_HEAD_H + firstBlock);
    stepTile(step, MARGIN, y, 8);
    const baseline = y + (8 + capHeight(TYPE.sectionTitle)) / 2;
    writeAt(title, MARGIN + 11, baseline, TYPE.sectionTitle);
    const titleWidth = textWidth(title, TYPE.sectionTitle);
    writeAt(
      fit(meta, CONTENT_W - 11 - titleWidth - 8, TYPE.sectionMeta),
      PAGE_W - MARGIN,
      baseline,
      TYPE.sectionMeta,
      "right",
    );
    rule(y + 11, COLOR.dividerSoft);
    y += SECTION_HEAD_H;
  };

  /** A smaller heading inside a section (no tile). */
  const subsectionHead = (title: string, meta: string, firstBlock: number) => {
    const height = lineHeight(TYPE.subsectionTitle) + 3;
    y += 7;
    ensure(height + firstBlock);
    const baseline = y + (lineHeight(TYPE.subsectionTitle) + capHeight(TYPE.subsectionTitle)) / 2;
    writeAt(title, MARGIN, baseline, TYPE.subsectionTitle);
    writeAt(meta, PAGE_W - MARGIN, baseline, TYPE.sectionMeta, "right");
    y += height;
  };

  /** Rows one under another, with the table's column labels repeated after a page break. */
  const table = (rows: Block[], header?: () => number) => {
    rows.forEach((row) => {
      if (y + row.height > PAGE_BOTTOM && y > PAGE_TOP) {
        newPage();
        if (header) y += header();
      }
      row.draw(MARGIN, y, row.height);
      y += row.height;
    });
  };

  /** Blocks in a grid; each row is as tall as its tallest block. */
  const grid = (blocks: Block[], columns: number, gap = CARD_GAP, rowGap = gap) => {
    const width = (CONTENT_W - gap * (columns - 1)) / columns;
    for (let i = 0; i < blocks.length; i += columns) {
      const row = blocks.slice(i, i + columns);
      const height = Math.max(...row.map((b) => b.height));
      if (i > 0) y += rowGap;
      ensure(height);
      row.forEach((b, j) => b.draw(MARGIN + j * (width + gap), y, height));
      y += height;
    }
  };

  // ---- Title band -----------------------------------------------------------

  const BAND_H = 46;
  pdf.setFillColor(COLOR.ink);
  pdf.rect(0, 0, PAGE_W, BAND_H, "F");
  // The four pipeline steps in order, in their identity colours.
  STEP_ORDER.forEach((step, i) => {
    pdf.setFillColor(stepColor(step));
    pdf.rect((PAGE_W / 4) * i, BAND_H - 1.6, PAGE_W / 4, 1.6, "F");
  });

  const dateLabel = date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  write("AI RESEARCH PIPELINE", MARGIN, 12, TYPE.overline);
  write(dateLabel.toUpperCase(), PAGE_W - MARGIN, 12, TYPE.overline, "right");
  write("Research Summary", MARGIN, 18.5, TYPE.title);
  const subtitle = [
    project.trim(),
    report.sources.length ? `Evidence from ${sourcesLabel(report.sources)}` : "",
  ]
    .filter(Boolean)
    .join("  ·  ");
  write(fit(subtitle || "Latest findings from your research pipeline", CONTENT_W, TYPE.subtitle), MARGIN, 31, TYPE.subtitle);

  // ---- Headline numbers -----------------------------------------------------

  y = BAND_H + 7;
  const STAT_H = 28;
  const statWidth = (CONTENT_W - CARD_GAP * 3) / 4;
  reportStats(report).forEach((stat, i) => {
    const x = MARGIN + i * (statWidth + CARD_GAP);
    card(x, y, statWidth, STAT_H);
    stepTile(stat.step, x + 3.4, y + 3.4, 4.6);
    write(
      fit(stat.label.toUpperCase(), statWidth - 12, TYPE.statLabel),
      x + 9.8,
      y + 3.4 + (4.6 - lineHeight(TYPE.statLabel)) / 2,
      TYPE.statLabel,
    );
    if (stat.value === null) {
      // Not run yet: a dash drawn as a bar (Helvetica has no em dash).
      fillRound(x + 3.6, y + 12.6, 6, 1.1, 0.5, COLOR.waiting);
    } else {
      write(String(stat.value), x + 3.2, y + 9, TYPE.statValue);
    }
    const detail = wrapList(stat.detail, statWidth - 6.8, TYPE.statDetail, 2);
    write(detail, x + 3.4, y + STAT_H - 3 - detail.length * lineHeight(TYPE.statDetail), TYPE.statDetail);
  });
  y += STAT_H;

  const sections = reportSections(report);

  // ---- 1 Key insights -------------------------------------------------------

  if (sections.includes("insights")) {
    const themes = report.themes ?? [];
    // Columns: rank, theme and description, sentiment chip, quote count.
    const rankW = 8;
    const chipW = 25;
    const quotesW = 14;
    const textW = CONTENT_W - rankW - chipW - quotesW - 8;
    const chipX = MARGIN + rankW + textW + 4;

    const header = () => {
      write("THEME", MARGIN + rankW, y, TYPE.label);
      write("SENTIMENT", chipX, y, TYPE.label);
      write("QUOTES", PAGE_W - MARGIN, y, TYPE.label, "right");
      return lineHeight(TYPE.label) + 0.6;
    };

    const rows = themes.map((theme: ReportTheme, i): Block => {
      const name = wrap(theme.name, textW, TYPE.rowTitle, 2);
      const description = wrap(theme.description, textW, TYPE.body, 3);
      const nameH = name.length * lineHeight(TYPE.rowTitle);
      return {
        height:
          ROW_PAD * 2 + nameH + (description.length ? 0.6 + description.length * lineHeight(TYPE.body) : 0),
        draw: (x, top) => {
          rule(top);
          const firstLine = top + ROW_PAD;
          // The chip and the quote count sit on the middle of the name's first line.
          const middle = firstLine + lineHeight(TYPE.rowTitle) / 2;
          write(String(i + 1).padStart(2, "0"), x, firstLine, { ...TYPE.rowTitle, color: COLOR.icon });
          write(name, x + rankW, firstLine, TYPE.rowTitle);
          write(description, x + rankW, firstLine + nameH + 0.6, TYPE.body);
          drawChip(SENTIMENT_CHIP[theme.sentiment], chipX, middle - CHIP_H / 2, chipW);
          const count = { size: 8.5, bold: true };
          writeAt(String(theme.quotes), PAGE_W - MARGIN, middle + capHeight(count) / 2, count, "right");
        },
      };
    });

    sectionHead("insight", "Key insights", sectionMeta(report, "insights"), 6 + (rows[0]?.height ?? 0));
    y += header();
    table(rows, header);
  }

  // ---- 2 User journey -------------------------------------------------------

  if (sections.includes("journey")) {
    const stages = report.stages ?? [];
    const n = stages.length;
    const colW = CONTENT_W / n;
    const plotH = 42;
    const padTop = 10;
    const padBottom = 6;
    const usable = plotH - padTop - padBottom;

    const numberStyle = { size: 6.5, color: COLOR.faint };
    const nameStyle = (friction: boolean) => ({
      size: 7.8,
      bold: true,
      color: friction ? COLOR.redText : COLOR.ink,
      leading: 1.25,
    });
    const emotionStyle = { size: 6.2, color: COLOR.text3, tracking: 0.2 };
    const labels = stages.map((stage) => ({
      name: wrap(stage.name, colW - 3, nameStyle(stage.friction), 2),
      emotion: stage.emotion ? fit(stage.emotion.toUpperCase(), colW - 3, emotionStyle) : "",
    }));
    const labelsH =
      2.4 +
      lineHeight(numberStyle) +
      Math.max(...labels.map((l) => l.name.length)) * lineHeight(nameStyle(false)) +
      (labels.some((l) => l.emotion) ? lineHeight(emotionStyle) + 0.4 : 0) +
      2.6;
    const legendH = 6;
    const chartH = lineHeight(TYPE.label) + 2 + plotH + labelsH + legendH;

    // Under the chart, what happens at each stage — numbered as on the chart,
    // which already shows the emotion and friction.
    const noteColumns = Math.min(3, n);
    const noteGap = 6;
    const noteW = (CONTENT_W - noteGap * (noteColumns - 1)) / noteColumns;
    const noteTitle = (friction: boolean) => ({
      size: 8.8,
      bold: true,
      color: friction ? COLOR.redText : COLOR.ink,
      leading: 1.3,
    });
    const noteBody = { size: 8, color: COLOR.text2, leading: 1.4 };
    const notes = stages.map((stage: ReportStage, i): Block => {
      const title = wrap(stage.name, noteW - 6, noteTitle(stage.friction), 2);
      const body = wrap(stage.description, noteW - 6, noteBody, 4);
      const titleH = title.length * lineHeight(noteTitle(false));
      return {
        height: titleH + (body.length ? 0.4 + body.length * lineHeight(noteBody) : 0),
        draw: (x, top) => {
          write(String(i + 1).padStart(2, "0"), x, top, { ...noteTitle(false), color: COLOR.icon });
          write(title, x + 6, top, noteTitle(stage.friction));
          write(body, x + 6, top + titleH + 0.4, noteBody);
        },
      };
    });

    sectionHead("journey", "User journey", sectionMeta(report, "journey"), chartH);

    // Chart title row.
    write("EMOTION BY STAGE", MARGIN, y, TYPE.label);
    write("HIGHER = MORE POSITIVE", PAGE_W - MARGIN, y, { ...TYPE.label, bold: false }, "right");
    y += lineHeight(TYPE.label) + 2;

    const plotTop = y;
    const labelsTop = plotTop + plotH;
    const points: [number, number][] = stages.map((stage, i) => [
      MARGIN + colW * i + colW / 2,
      plotTop + padTop + ((100 - stage.score) / 100) * usable,
    ]);
    const lowest = points.reduce((lo, p, i) => (p[1] > points[lo][1] ? i : lo), 0);

    // Friction bands behind contiguous friction stages, down through the labels.
    const frictionCount = stages.filter((s) => s.friction).length;
    contiguousRuns(stages.map((s) => s.friction)).forEach(([a, b], k) => {
      const x = MARGIN + colW * a;
      fillRound(x, plotTop, colW * (b - a + 1), plotH + labelsH, 1.6, COLOR.redBand);
      if (k === 0) {
        const style = { size: 6.2, bold: true, color: COLOR.redText, tracking: 0.25 };
        const long = `FRICTION · ${frictionCount} ${frictionCount === 1 ? "STAGE" : "STAGES"}`;
        const label = textWidth(long, style) + 4 <= colW * (b - a + 1) ? long : `FRICTION · ${frictionCount}`;
        write(label, x + 2, plotTop + 1.6, style);
      }
    });

    // Guides: top, middle (dashed) and baseline.
    [0, 0.5, 1].forEach((f) => {
      pdf.setLineDashPattern(f === 1 ? [] : [0.8, 1.2], 0);
      rule(plotTop + padTop + usable * f, COLOR.dividerSoft);
    });
    // Dotted drop line from each point to its label.
    pdf.setLineDashPattern([0.3, 1], 0);
    pdf.setDrawColor(COLOR.border);
    pdf.setLineWidth(0.25);
    points.forEach(([x, py]) => pdf.line(x, py + 2.2, x, labelsTop));
    pdf.setLineDashPattern([], 0);

    const curve = smoothSegments(points);
    if (n > 1) {
      // Soft fill under the curve.
      pdf.saveGraphicsState();
      pdf.setGState(new GState({ opacity: 0.1 }));
      pdf.setFillColor(stepColor("journey"));
      pdf.moveTo(points[0][0], points[0][1]);
      curve.forEach((s) => pdf.curveTo(s[0], s[1], s[2], s[3], s[4], s[5]));
      pdf.lineTo(points[n - 1][0], labelsTop);
      pdf.lineTo(points[0][0], labelsTop);
      pdf.close();
      pdf.fill();
      pdf.restoreGraphicsState();

      pdf.setDrawColor(stepColor("journey"));
      pdf.setLineWidth(0.7);
      pdf.setLineCap("round");
      pdf.setLineJoin("round");
      pdf.moveTo(points[0][0], points[0][1]);
      curve.forEach((s) => pdf.curveTo(s[0], s[1], s[2], s[3], s[4], s[5]));
      pdf.stroke();
      pdf.setLineCap("butt");
      pdf.setLineJoin("miter");
    }

    // One point per stage, coloured by tone; the lowest is larger.
    points.forEach(([x, py], i) => {
      pdf.setFillColor(TONE_COLOR[stages[i].tone]);
      pdf.setDrawColor(COLOR.white);
      pdf.setLineWidth(0.55);
      pdf.circle(x, py, i === lowest ? 1.9 : 1.5, "FD");
    });
    if (n > 1) {
      const [px, py] = points[lowest];
      const w = 19;
      const h = 4.4;
      const cx = Math.min(Math.max(px, MARGIN + w / 2 + 1), PAGE_W - MARGIN - w / 2 - 1);
      const top = py + 3.4 + h <= labelsTop - 0.5 ? py + 3.4 : py - 3.4 - h;
      pdf.setFillColor(COLOR.white);
      pdf.setDrawColor(COLOR.dividerSoft);
      pdf.setLineWidth(0.25);
      pdf.roundedRect(cx - w / 2, top, w, h, h / 2, h / 2, "FD");
      const style = { size: 6.3, color: COLOR.lowText };
      writeAt("Lowest point", cx, top + (h + capHeight(style)) / 2, style, "center");
    }

    // Stage labels under the chart.
    rule(labelsTop, COLOR.dividerSoft);
    stages.forEach((stage, i) => {
      const cx = MARGIN + colW * i + colW / 2;
      let top = labelsTop + 2.4;
      top += write(String(i + 1).padStart(2, "0"), cx, top, numberStyle, "center");
      top += write(labels[i].name, cx, top, nameStyle(stage.friction), "center") + 0.4;
      if (labels[i].emotion) write(labels[i].emotion, cx, top, emotionStyle, "center");
    });
    y = labelsTop + labelsH + 2.4;

    // Legend.
    let lx = MARGIN;
    const legendStyle = { size: 6.8, color: COLOR.muted };
    const legendMiddle = y + 1.6;
    [
      { color: COLOR.redText, label: "Negative" },
      { color: COLOR.amberDot, label: "Mixed" },
      { color: stepColor("journey"), label: "Positive / neutral" },
    ].forEach(({ color, label }) => {
      pdf.setFillColor(color);
      pdf.circle(lx + 1, legendMiddle, 1, "F");
      writeAt(label, lx + 3, legendMiddle + capHeight(legendStyle) / 2, legendStyle);
      lx += 3 + textWidth(label, legendStyle) + 5;
    });
    pdf.setFillColor(COLOR.redBand);
    pdf.setDrawColor(COLOR.redBorder);
    pdf.setLineWidth(0.25);
    pdf.roundedRect(lx, legendMiddle - 1.2, 3.4, 2.4, 0.6, 0.6, "FD");
    writeAt("Friction", lx + 4.6, legendMiddle + capHeight(legendStyle) / 2, legendStyle);
    y += legendH + 1;

    ensure(3.4 + Math.max(...notes.slice(0, noteColumns).map((b) => b.height)));
    rule(y);
    y += 3.4;
    grid(notes, noteColumns, noteGap, 4);
  }

  // ---- 3 Safety risks -------------------------------------------------------

  if (sections.includes("safety")) {
    const risks = report.risks ?? [];
    const cardW = (CONTENT_W - CARD_GAP) / 2;
    const innerW = cardW - CARD_PAD * 2;
    const approvedStyle = { size: 6.3, bold: true, color: stepColor("safety"), tracking: 0.25 };
    const toReview: Chip = { label: "To review", bg: COLOR.amberBg, fg: COLOR.amberText, caps: true };

    const cards = risks.map((risk: ReportRisk): Block => {
      const statusW = risk.approved ? textWidth("APPROVED", approvedStyle) : chipWidth(toReview);
      const chips: Chip[] = [];
      if (risk.category) chips.push({ label: risk.category, bg: COLOR.redBg, fg: COLOR.redText });
      if (risk.stage) chips.push({ label: risk.stage, bg: COLOR.violetBg, fg: COLOR.violetText });
      const chipsW = innerW - statusW - 3;
      const chipsH = Math.max(CHIP_H, chipFlow(chips, chipsW));
      const summary = wrap(risk.summary, innerW, TYPE.cardTitle, 3);
      const reason = wrap(risk.reason, innerW, TYPE.body, 6);
      const height =
        CARD_PAD * 2 +
        chipsH +
        2.6 +
        summary.length * lineHeight(TYPE.cardTitle) +
        (reason.length ? 1 + reason.length * lineHeight(TYPE.body) : 0);
      return {
        height,
        draw: (x, top, h) => {
          card(x, top, cardW, h);
          const inner = x + CARD_PAD;
          chipFlow(chips, chipsW, { x: inner, top: top + CARD_PAD });
          if (risk.approved) {
            writeAt("APPROVED", x + cardW - CARD_PAD, top + CARD_PAD + (CHIP_H + capHeight(approvedStyle)) / 2, approvedStyle, "right");
          } else {
            drawChip(toReview, x + cardW - CARD_PAD - statusW, top + CARD_PAD);
          }
          let ty = top + CARD_PAD + chipsH + 2.6;
          ty += write(summary, inner, ty, TYPE.cardTitle) + 1;
          write(reason, inner, ty, TYPE.body);
        },
      };
    });

    const emptyNote =
      risks.length === 0
        ? report.dismissedRisks
          ? "Every flagged risk was dismissed in review."
          : "No safety risks were flagged."
        : "";
    sectionHead("safety", "Safety risks", sectionMeta(report, "safety"), cards[0]?.height ?? 10);
    if (emptyNote) {
      fillRound(MARGIN, y, CONTENT_W, 9, 2, COLOR.sunken);
      write(emptyNote, MARGIN + 4, y + (9 - lineHeight(TYPE.body)) / 2, TYPE.body);
      y += 9;
    }
    grid(cards, 2);

    if (report.clearStages.length) {
      const label = "NO CONCERNS FOUND AT";
      const labelW = textWidth(label, TYPE.label) + 3;
      const chips = report.clearStages.map((stage) => ({ label: stage, bg: COLOR.violetBg, fg: COLOR.violetText }));
      const height = chipFlow(chips, CONTENT_W - labelW);
      y += 5;
      ensure(height);
      write(label, MARGIN, y + (CHIP_H - lineHeight(TYPE.label)) / 2, TYPE.label);
      chipFlow(chips, CONTENT_W - labelW, { x: MARGIN + labelW, top: y });
      y += height;
    }
    if (report.dismissedRisks && risks.length) {
      y += 3.5;
      ensure(lineHeight(TYPE.small));
      const count = report.dismissedRisks;
      y += write(
        `${count} ${count === 1 ? "risk was" : "risks were"} dismissed in Safety Risk Review and ${count === 1 ? "is" : "are"} not shown.`,
        MARGIN,
        y,
        TYPE.small,
      );
    }
  }

  // ---- 4 Recommendations and research next ----------------------------------

  if (sections.includes("recommendations")) {
    const recommendations = report.recommendations ?? [];
    const cardW = (CONTENT_W - CARD_GAP) / 2;
    const innerW = cardW - CARD_PAD * 2;
    const stepIndent = 6;

    const cards = recommendations.map((rec: ReportRecommendation): Block => {
      const chips: Chip[] = [];
      if (rec.category) chips.push({ label: `Responds to · ${rec.category}`, bg: COLOR.redBg, fg: COLOR.redText });
      if (rec.stage) chips.push({ label: rec.stage, bg: COLOR.violetBg, fg: COLOR.violetText });
      const chipsH = chipFlow(chips, innerW);
      const title = wrap(rec.title, innerW, TYPE.cardTitle, 3);
      const why = wrap(rec.why, innerW, TYPE.bodyMuted, 4);
      const steps = rec.steps.map((step) => wrap(step, innerW - stepIndent, TYPE.body, 4));
      const stepsH = steps.reduce((sum, lines) => sum + lines.length * lineHeight(TYPE.body), 0) + (steps.length - 1) * 1.6;
      const height =
        CARD_PAD * 2 +
        (chipsH ? chipsH + 2.6 : 0) +
        title.length * lineHeight(TYPE.cardTitle) +
        (why.length ? 1 + why.length * lineHeight(TYPE.bodyMuted) : 0) +
        (steps.length ? 3 + stepsH : 0);
      return {
        height,
        draw: (x, top, h) => {
          card(x, top, cardW, h);
          const inner = x + CARD_PAD;
          let ty = top + CARD_PAD;
          if (chipsH) ty += chipFlow(chips, innerW, { x: inner, top: ty }) + 2.6;
          ty += write(title, inner, ty, TYPE.cardTitle);
          if (why.length) ty += 1 + write(why, inner, ty + 1, TYPE.bodyMuted);
          if (steps.length) ty += 3;
          steps.forEach((lines, i) => {
            // Numbered circle, as on the UX Recommendations box.
            const middle = ty + lineHeight(TYPE.body) / 2;
            pdf.setFillColor(COLOR.greenBg);
            pdf.circle(inner + 2, middle, 2, "F");
            const number = { size: 6.3, bold: true, color: stepColor("coach") };
            writeAt(String(i + 1), inner + 2, middle + capHeight(number) / 2, number, "center");
            ty += write(lines, inner + stepIndent, ty, TYPE.body) + 1.6;
          });
        },
      };
    });

    sectionHead("coach", "Recommendations", sectionMeta(report, "recommendations"), cards[0]?.height ?? 0);
    grid(cards, 2);
  }

  if (sections.includes("research")) {
    const textW = CONTENT_W - 7;
    const rows = report.researchNext.map((item): Block => {
      const question = wrap(item.question, textW, TYPE.rowTitle, 3);
      const why = wrap(item.why, textW, TYPE.bodyMuted, 2);
      const height =
        ROW_PAD * 2 +
        question.length * lineHeight(TYPE.rowTitle) +
        (why.length ? 0.4 + why.length * lineHeight(TYPE.bodyMuted) : 0);
      return {
        height,
        draw: (x, top) => {
          rule(top);
          const firstLine = top + ROW_PAD;
          const middle = firstLine + lineHeight(TYPE.rowTitle) / 2;
          pdf.setDrawColor(COLOR.waiting);
          pdf.setLineWidth(0.35);
          pdf.roundedRect(x + 0.2, middle - 1.6, 3.2, 3.2, 0.6, 0.6, "S");
          const questionH = write(question, x + 7, firstLine, TYPE.rowTitle);
          write(why, x + 7, firstLine + questionH + 0.4, TYPE.bodyMuted);
        },
      };
    });
    const meta = sectionMeta(report, "research");
    if (sections.includes("recommendations")) subsectionHead("Research next", meta, rows[0].height);
    else sectionHead("coach", "Research next", meta, rows[0].height);
    table(rows);
  }

  // ---- Closing note -----------------------------------------------------------

  if (sections.length) {
    const note = wrap(
      "Generated by the AI research pipeline. Themes cite participant quotes from the research " +
        "material; journey stages may be inferred where the material doesn't name them. Risks marked " +
        "To review have not been checked by a researcher yet, and recommendations are advisory, so " +
        "confirm findings against the source material before acting on them.",
      CONTENT_W - 8,
      { ...TYPE.small, color: COLOR.text3 },
    );
    const height = note.length * lineHeight(TYPE.small) + 6;
    y += 7;
    ensure(height);
    fillRound(MARGIN, y, CONTENT_W, height, 2, COLOR.sunken);
    write(note, MARGIN + 4, y + 3, { ...TYPE.small, color: COLOR.text3 });
  }

  // ---- Footer on every page ---------------------------------------------------

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    rule(PAGE_H - 13, COLOR.dividerSoft);
    writeAt(`Research Summary  ·  ${dateLabel}`, MARGIN, PAGE_H - 8.5, TYPE.footer);
    writeAt(`Page ${page} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 8.5, TYPE.footer, "right");
  }

  return pdf;
}
