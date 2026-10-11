import { describe, expect, it } from "vitest";

import {
  applyEmotes,
  isCommand,
  plainText,
  toComment,
  truncate,
  type Emote,
  type Part,
} from "./body";

const text = (value: string): Part => ({ kind: "text", text: value });
const emote = (code: string): Emote => ({
  kind: "emote",
  code,
  src: `https://e/${code}`,
  aspect: 1,
});

describe("isCommand", () => {
  it("spots a message starting with !", () => {
    expect(isCommand([text(" !uptime")])).toBe(true);
    expect(isCommand([text("hi !uptime")])).toBe(false);
    expect(isCommand([emote("Kappa"), text(" !x")])).toBe(false);
  });
});

describe("applyEmotes", () => {
  const index = new Map([["KEKW", emote("KEKW")]]);

  it("swaps whole words only", () => {
    expect(applyEmotes([text("lol KEKW KEKWait xKEKW")], index)).toEqual([
      text("lol "),
      emote("KEKW"),
      text(" KEKWait xKEKW"),
    ]);
  });

  it("matches case-sensitively, as the providers do", () => {
    expect(applyEmotes([text("kekw")], index)).toEqual([text("kekw")]);
  });
});

describe("truncate", () => {
  it("leaves a body within the limit alone", () => {
    const body = [text("a".repeat(49)), emote("E")];
    expect(truncate(body, 50)).toEqual(body);
  });

  it("counts an Emote as one character", () => {
    const body = [emote("A"), text("b".repeat(49)), emote("C")];
    expect(truncate(body, 50)).toEqual([emote("A"), text(`${"b".repeat(49)}…`)]);
  });

  it("cuts by grapheme, so an emoji or a combined character is never split", () => {
    const family = "👨‍👩‍👧";
    expect(plainText(truncate([text(family.repeat(3))], 2))).toBe(`${family.repeat(2)}…`);
  });

  it("marks a cut that lands right after an Emote", () => {
    expect(truncate([emote("A"), emote("B"), emote("C")], 2)).toEqual([
      emote("A"),
      emote("B"),
      text("…"),
    ]);
  });
});

describe("toComment", () => {
  it("collapses whitespace and trims the ends", () => {
    expect(toComment([text("  hi \n  there "), emote("E"), text("  ")], new Map())).toEqual([
      text("hi there "),
      emote("E"),
    ]);
  });

  it("has nothing to show for a blank body", () => {
    expect(toComment([text("   ")], new Map())).toBeUndefined();
  });
});
