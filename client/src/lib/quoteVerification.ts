export function verifyQuote(quote: string, sourceText: string): boolean {
  if (!quote || !sourceText) return false;

  const normalize = (s: string) =>
    s
      .trim()
      .replace(/[\u201C\u201D]/g, '"') // curly double quotes -> straight
      .replace(/[\u2018\u2019]/g, "'") // curly single quotes -> straight
      .replace(/\s+/g, " "); // collapse whitespace/newlines

  return normalize(sourceText).includes(normalize(quote));
}

export function verifyThemesAgainstSource(
  themes: Array<{
    evidence: Array<{ quote: string; source: string; verified?: boolean }>;
    [key: string]: any;
  }>,
  sourceText: string
) {
  return themes.map((theme) => ({
    ...theme,
    evidence: theme.evidence.map((ev) => ({
      ...ev,
      verified: verifyQuote(ev.quote, sourceText),
    })),
  }));
}