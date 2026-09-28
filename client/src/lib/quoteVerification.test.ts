import { describe, expect, it } from "vitest";
import { verifyQuote, verifyThemesAgainstSource } from "./quoteVerification.js";

/**
 * The cases here are drawn from a real Insight Weaver run over the demo
 * transcripts: the matcher must forgive typography and elision, and must NOT
 * forgive the model rewording a participant.
 */

const SOURCE = [
  "I went in and read it, but I wasn't really sure if I was supposed to do anything after that.",
  "I remember being asked for some information again that I thought I'd already put in online.",
  "There was also something there about who to contact if I had any questions, so... yeah, I knew where to go if I needed help.",
  "I think if there'd been one place that clearly said, okay, this is what's changed, this is what you need to do now, this is when you need to follow up, and this is who you call if something doesn't look right... that would've made it a lot easier.",
].join("\n\n");

describe("verifyQuote", () => {
  it("accepts an exact quote", () => {
    expect(
      verifyQuote("I knew where to go if I needed help", SOURCE),
    ).toBe(true);
  });

  it("accepts curly quotes and dashes where the source has straight ones", () => {
    expect(
      verifyQuote("I wasn’t really sure if I was supposed to do anything", SOURCE),
    ).toBe(true);
  });

  it("accepts a quote whose line breaks were collapsed", () => {
    expect(
      verifyQuote("I remember being asked\n  for some information again", SOURCE),
    ).toBe(true);
  });

  it("accepts a quote that ends with different punctuation", () => {
    // Source continues with a comma; the model closed the sentence.
    expect(
      verifyQuote("There was also something there about who to contact if I had any questions.", SOURCE),
    ).toBe(true);
  });

  it("accepts an elision when every fragment is verbatim and in order", () => {
    expect(
      verifyQuote(
        "I think if there'd been one place that clearly said, okay, this is what's changed, this is what you need to do now... that would've made it a lot easier.",
        SOURCE,
      ),
    ).toBe(true);
  });

  it("rejects an elision whose fragments appear out of order", () => {
    expect(
      verifyQuote(
        "that would've made it a lot easier... this is what you need to do now",
        SOURCE,
      ),
    ).toBe(false);
  });

  it("rejects a paraphrase that drops words", () => {
    // Source: "I remember being asked for some information again".
    expect(
      verifyQuote("I was asked for some information again that I thought I'd already put in online.", SOURCE),
    ).toBe(false);
  });

  it("rejects a quote reworded into reported speech", () => {
    expect(
      verifyQuote("the GP hadn't actually received his discharge summary yet.", SOURCE),
    ).toBe(false);
  });

  it("rejects fragments too short to be evidence", () => {
    expect(verifyQuote("I went... help", SOURCE)).toBe(false);
  });

  it("rejects empty input on either side", () => {
    expect(verifyQuote("", SOURCE)).toBe(false);
    expect(verifyQuote("I knew where to go", "")).toBe(false);
  });
});

describe("verifyThemesAgainstSource", () => {
  it("stamps verified on each piece of evidence without altering the theme", () => {
    const [theme] = verifyThemesAgainstSource(
      [
        {
          theme: "Unclear guidance",
          evidence: [
            { quote: "I knew where to go if I needed help", source: "P2" },
            { quote: "something the participant never said", source: "P2" },
          ],
        },
      ],
      SOURCE,
    );
    expect(theme.theme).toBe("Unclear guidance");
    expect(theme.evidence.map((e) => e.verified)).toEqual([true, false]);
  });
});
