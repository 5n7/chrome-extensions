import { describe, expect, it } from "vitest";

import type { Rules } from "./rules";
import {
  applyRules,
  currentSource,
  currentSpeed,
  learnFacts,
  startTarget,
  stepTarget,
} from "./target";

const rules: Rules = {
  defaultSpeed: 1,
  titleRules: [{ id: "t", pattern: "asmr", speed: 0.5 }],
  channelRules: [{ handle: "@dailylisp", id: "c", speed: 2 }],
};

describe("Target", () => {
  it("plays at the Default Speed until the facts the rules need arrive", () => {
    const target = startTarget("v1");
    expect(currentSpeed(target, rules)).toBe(1);
    expect(currentSource(target)).toBeUndefined();
    const known = learnFacts(target, { handle: "@dailylisp", title: "Macros" }, rules);
    expect(currentSpeed(known, rules)).toBe(2);
    expect(currentSource(known)).toEqual({ handle: "@dailylisp", kind: "channel" });
  });

  it("keeps a Manual Speed picked before the facts arrive", () => {
    const stepped = stepTarget(startTarget("v1"), "up", rules);
    const known = learnFacts(stepped, { handle: "@dailylisp", title: "Macros" }, rules);
    expect(currentSpeed(known, rules)).toBe(1.5);
    expect(currentSource(known)).toEqual({ kind: "manual" });
  });

  it("steps from the current Speed and stops at the ends", () => {
    let target = learnFacts(startTarget("v1"), { handle: "@dailylisp", title: "Macros" }, rules);
    for (let i = 0; i < 5; i++) target = stepTarget(target, "up", rules);
    expect(currentSpeed(target, rules)).toBe(3);
  });

  it("keeps the Manual Speed when a rule change leaves the Rule Speed alone", () => {
    const target = stepTarget(
      learnFacts(startTarget("v1"), { handle: "@dailylisp", title: "Macros" }, rules),
      "up",
      rules,
    );
    const next = { ...rules, defaultSpeed: 3 as const };
    expect(currentSpeed(applyRules(target, rules, next), next)).toBe(2.5);
  });

  it("drops the Manual Speed when the Rule Speed changes", () => {
    const target = stepTarget(
      learnFacts(startTarget("v1"), { handle: "@dailylisp", title: "Macros" }, rules),
      "up",
      rules,
    );
    const next = {
      ...rules,
      channelRules: [{ handle: "@dailylisp", id: "c", speed: 0.5 as const }],
    };
    const applied = applyRules(target, rules, next);
    expect(currentSpeed(applied, next)).toBe(0.5);
    expect(currentSource(applied)).toEqual({ handle: "@dailylisp", kind: "channel" });
  });
});
