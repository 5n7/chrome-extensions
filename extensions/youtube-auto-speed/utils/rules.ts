import { isRecord } from "./is-record";
import { isSpeed, type Speed } from "./speed";

export interface TitleRule {
  id: string;
  pattern: string;
  speed: Speed;
}

export interface ChannelRule {
  id: string;
  /** Normalized by `normalizeHandle` when valid; kept as typed otherwise, so it never matches. */
  handle: string;
  speed: Speed;
}

export interface Rules {
  defaultSpeed: Speed;
  titleRules: readonly TitleRule[];
  channelRules: readonly ChannelRule[];
}

/** What a Target Video is known by; each part stays undefined until read from the current video. */
export interface VideoFacts {
  title?: string;
  handle?: string;
}

export type RuleSource =
  | { kind: "title"; pattern: string }
  | { kind: "channel"; handle: string }
  | { kind: "default" };

export interface RuleSpeed {
  speed: Speed;
  source: RuleSource;
}

// Handles are letters, digits, `_`, `-`, `.`, and `·`, in any script.
const HANDLE = /^@[\p{L}\p{M}\p{N}_.·-]+$/u;
const HANDLE_URL = /^(?:https?:\/\/)?(?:(?:www|m)\.)?youtube\.com\/(@[^/?#]+)/i;

export function newRuleId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/** Undefined for an empty or invalid pattern, which matches nothing. */
export function compilePattern(pattern: string): RegExp | undefined {
  if (!pattern) return undefined;
  try {
    return new RegExp(pattern, "i");
  } catch {
    return undefined;
  }
}

/** Turns `name`, `@name`, or a channel URL into `@name`; undefined when no handle is in it. */
export function normalizeHandle(input: string): string | undefined {
  let text = input.trim();
  text = HANDLE_URL.exec(text)?.[1] ?? text;
  try {
    text = decodeURIComponent(text);
  } catch {
    return undefined;
  }
  // A Japanese IME types the full-width `＠`.
  text = text.replace(/^＠/, "@");
  if (!text.startsWith("@")) text = `@${text}`;
  return HANDLE.test(text) ? text : undefined;
}

/** Compares as YouTube does, ignoring case; text that is not a handle matches nothing. */
export function sameHandle(a: string, b: string): boolean {
  const left = normalizeHandle(a);
  const right = normalizeHandle(b);
  return left !== undefined && right !== undefined && left.toLowerCase() === right.toLowerCase();
}

export function findChannelRule(
  rules: readonly ChannelRule[],
  handle: string,
): ChannelRule | undefined {
  return rules.find((rule) => sameHandle(rule.handle, handle));
}

/**
 * The Rule Speed, or undefined while a title or handle it depends on is still unknown. Facts only
 * matter when some rule needs them, so a missing title is fine when no Title Rule can match.
 */
export function resolveRuleSpeed(rules: Rules, facts: VideoFacts): RuleSpeed | undefined {
  const titleRules = rules.titleRules.flatMap((rule) => {
    const regex = compilePattern(rule.pattern);
    return regex ? [{ regex, rule }] : [];
  });
  if (titleRules.length > 0) {
    if (facts.title === undefined) return undefined;
    const title = facts.title;
    const match = titleRules.find(({ regex }) => regex.test(title));
    if (match)
      return { speed: match.rule.speed, source: { kind: "title", pattern: match.rule.pattern } };
  }
  if (rules.channelRules.length > 0) {
    if (facts.handle === undefined) return undefined;
    const rule = findChannelRule(rules.channelRules, facts.handle);
    if (rule) return { speed: rule.speed, source: { kind: "channel", handle: rule.handle } };
  }
  return { speed: rules.defaultSpeed, source: { kind: "default" } };
}

/** Keeps the well-formed rules of a stored list; anything that is not a list holds none. */
export function readTitleRules(stored: unknown): TitleRule[] {
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (rule): rule is TitleRule =>
      isRecord(rule) &&
      typeof rule.id === "string" &&
      typeof rule.pattern === "string" &&
      isSpeed(rule.speed),
  );
}

/** Keeps the well-formed rules of a stored list; anything that is not a list holds none. */
export function readChannelRules(stored: unknown): ChannelRule[] {
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (rule): rule is ChannelRule =>
      isRecord(rule) &&
      typeof rule.id === "string" &&
      typeof rule.handle === "string" &&
      isSpeed(rule.speed),
  );
}
