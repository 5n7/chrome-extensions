import {
  resolveRuleSpeed,
  type RuleSource,
  type RuleSpeed,
  type Rules,
  type VideoFacts,
} from "./rules";
import type { Direction } from "./shortcuts";
import { stepSpeed, type Speed } from "./speed";

/** What the extension knows and has decided about the Target Video in a tab. */
export interface Target {
  videoId: string;
  facts: VideoFacts;
  /** Undefined until the facts the rules need are known; the Default Speed stands in meanwhile. */
  ruleSpeed?: RuleSpeed;
  manualSpeed?: Speed;
}

export type SpeedSource = RuleSource | { kind: "manual" };

export function startTarget(videoId: string): Target {
  return { videoId, facts: {} };
}

export function currentSpeed(target: Target, rules: Rules): Speed {
  return target.manualSpeed ?? target.ruleSpeed?.speed ?? rules.defaultSpeed;
}

export function currentSource(target: Target): SpeedSource | undefined {
  return target.manualSpeed === undefined ? target.ruleSpeed?.source : { kind: "manual" };
}

/** Records newly read facts; a Manual Speed picked before they arrived stays. */
export function learnFacts(target: Target, facts: VideoFacts, rules: Rules): Target {
  return { ...target, facts, ruleSpeed: resolveRuleSpeed(rules, facts) };
}

/** Re-resolves after the rules change, dropping the Manual Speed only when the Rule Speed moves. */
export function applyRules(target: Target, previous: Rules, next: Rules): Target {
  const ruleSpeed = resolveRuleSpeed(next, target.facts);
  const before = target.ruleSpeed?.speed ?? previous.defaultSpeed;
  const after = ruleSpeed?.speed ?? next.defaultSpeed;
  return { ...target, ruleSpeed, manualSpeed: before === after ? target.manualSpeed : undefined };
}

export function stepTarget(target: Target, direction: Direction, rules: Rules): Target {
  return { ...target, manualSpeed: stepSpeed(currentSpeed(target, rules), direction) };
}
