/**
 * Checks that a quote an AI box attributed to a participant really appears in
 * the research material, so the UI can mark evidence Verified or Unverified.
 *
 * Deliberately a literal text match, not a similarity score: the point is to
 * catch the model rewriting a participant's words, which is exactly what a
 * fuzzy match would hide. It forgives only differences that carry no meaning —
 * typography, whitespace, terminal punctuation — and elisions, where a quote
 * skips material with an ellipsis but every fragment is still verbatim and in
 * order.
 */

/** Fragments shorter than this are too weak to count as evidence of a match. */
const MIN_FRAGMENT_CHARS = 12;

/** An ellipsis, as either the character or three dots, with any spacing. */
const ELLIPSIS = /\s*(?:…|\.\.\.)\s*/;

/**
 * Reduces text to what the comparison should care about: straight quotes and
 * dashes, single spaces, no case. Everything here is a difference a reader
 * would not notice, so forgiving it cannot hide a rewritten quote.
 */
function normalize(s: string): string {
  return s
    .replace(/[“”]/g, '"') // curly double quotes -> straight
    .replace(/[‘’]/g, "'") // curly single quotes -> straight
    .replace(/[–—]/g, "-") // en/em dash -> hyphen
    .replace(/ /g, " ") // non-breaking space -> space
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Drops the quotation marks and sentence-ending punctuation a model adds or
 * removes when lifting a fragment out of a sentence — a quote ending "." where
 * the transcript continues "," is still the participant's words.
 */
function trimEdges(s: string): string {
  return s.replace(/^["'\s]+/, "").replace(/["'.,;:!?\s]+$/, "");
}

/** True when the source contains this quote, allowing only cosmetic differences. */
export function verifyQuote(quote: string, sourceText: string): boolean {
  if (!quote || !sourceText) return false;

  const source = normalize(sourceText);
  const normalized = trimEdges(normalize(quote));
  if (!normalized) return false;

  if (source.includes(normalized)) return true;

  // An elided quote: every fragment must appear, in order, so the model cannot
  // pass by stitching together words the participant never said in sequence.
  const fragments = normalized
    .split(ELLIPSIS)
    .map(trimEdges)
    .filter(Boolean);

  if (fragments.length < 2) return false;
  if (fragments.some((f) => f.length < MIN_FRAGMENT_CHARS)) return false;

  let searchFrom = 0;
  for (const fragment of fragments) {
    const at = source.indexOf(fragment, searchFrom);
    if (at === -1) return false;
    searchFrom = at + fragment.length;
  }
  return true;
}

/**
 * Stamps `verified` onto every piece of evidence in every theme. Generic so a
 * theme's other fields (id, name, sentiment…) survive the round trip with
 * their types intact.
 */
export function verifyThemesAgainstSource<
  T extends {
    evidence: Array<{ quote: string; source: string; verified?: boolean }>;
  },
>(
  themes: T[],
  sourceText: string
): Array<
  Omit<T, "evidence"> & {
    evidence: Array<T["evidence"][number] & { verified: boolean }>;
  }
> {
  return themes.map((theme) => ({
    ...theme,
    evidence: theme.evidence.map((ev) => ({
      ...ev,
      verified: verifyQuote(ev.quote, sourceText),
    })),
  }));
}
