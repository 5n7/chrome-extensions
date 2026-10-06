import { describe, expect, it } from "vitest";

import {
  compilePattern,
  normalizeHandle,
  readChannelRules,
  readTitleRules,
  resolveRuleSpeed,
  type Rules,
} from "./rules";

const rules: Rules = {
  defaultSpeed: 1.5,
  titleRules: [
    { id: "t1", pattern: "", speed: 3 },
    { id: "t2", pattern: "(live", speed: 3 },
    { id: "t3", pattern: "asmr|relaxing", speed: 1 },
    { id: "t4", pattern: "ASMR", speed: 0.5 },
  ],
  channelRules: [
    { handle: "@DailyLisp", id: "c1", speed: 2 },
    { handle: "@dailylisp", id: "c2", speed: 2.5 },
  ],
};

describe("compilePattern", () => {
  it("treats empty and invalid patterns as matching nothing", () => {
    expect(compilePattern("")).toBeUndefined();
    expect(compilePattern("(live")).toBeUndefined();
  });

  it("ignores case", () => {
    expect(compilePattern("asmr")?.test("Relaxing ASMR")).toBe(true);
  });
});

describe("normalizeHandle", () => {
  it("accepts a bare name, a handle, or a channel URL", () => {
    expect(normalizeHandle("dailylisp")).toBe("@dailylisp");
    expect(normalizeHandle("  @dailylisp ")).toBe("@dailylisp");
    expect(normalizeHandle("https://www.youtube.com/@dailylisp/videos")).toBe("@dailylisp");
    expect(normalizeHandle("youtube.com/@daily.lisp-talks_")).toBe("@daily.lisp-talks_");
  });

  it("decodes handles in other scripts", () => {
    expect(normalizeHandle("@%E3%81%AB%E3%81%93")).toBe("@にこ");
  });

  it("rejects text that cannot be a handle", () => {
    expect(normalizeHandle("")).toBeUndefined();
    expect(normalizeHandle("daily lisp")).toBeUndefined();
    expect(normalizeHandle("https://example.com/watch")).toBeUndefined();
  });
});

describe("resolveRuleSpeed", () => {
  it("lets the first matching Title Rule win over Channel Rules", () => {
    expect(resolveRuleSpeed(rules, { handle: "@dailylisp", title: "Rain ASMR" })).toEqual({
      source: { kind: "title", pattern: "asmr|relaxing" },
      speed: 1,
    });
  });

  it("falls back to the first Channel Rule for the handle, ignoring case", () => {
    expect(resolveRuleSpeed(rules, { handle: "@DAILYLISP", title: "Macros" })).toEqual({
      source: { handle: "@DailyLisp", kind: "channel" },
      speed: 2,
    });
  });

  it("falls back to the Default Speed", () => {
    expect(resolveRuleSpeed(rules, { handle: "@other", title: "Macros" })).toEqual({
      source: { kind: "default" },
      speed: 1.5,
    });
  });

  it("waits for the title while a Title Rule could match", () => {
    expect(resolveRuleSpeed(rules, { handle: "@dailylisp" })).toBeUndefined();
  });

  it("decides on the title alone when it matches, before the handle is known", () => {
    expect(resolveRuleSpeed(rules, { title: "relaxing piano" })?.speed).toBe(1);
  });

  it("waits for the handle only while a Channel Rule could match", () => {
    expect(resolveRuleSpeed(rules, { title: "Macros" })).toBeUndefined();
    expect(resolveRuleSpeed({ ...rules, channelRules: [] }, { title: "Macros" })?.speed).toBe(1.5);
  });

  it("needs no title when every Title Rule is skipped", () => {
    const skipped = { ...rules, titleRules: rules.titleRules.slice(0, 2) };
    expect(resolveRuleSpeed(skipped, { handle: "@other" })?.speed).toBe(1.5);
  });
});

describe("readTitleRules and readChannelRules", () => {
  it("keep only well-formed rules", () => {
    expect(
      readTitleRules([
        { id: "a", pattern: "x", speed: 2 },
        { id: "b", pattern: "y", speed: 1.25 },
        "junk",
      ]),
    ).toEqual([{ id: "a", pattern: "x", speed: 2 }]);
    expect(readChannelRules([{ handle: "@a", id: "a", speed: 1 }, { id: "b" }])).toEqual([
      { handle: "@a", id: "a", speed: 1 },
    ]);
  });

  it("hold no rules when the stored value is not a list", () => {
    expect(readTitleRules(undefined)).toEqual([]);
    expect(readChannelRules({ handle: "@a" })).toEqual([]);
  });
});
