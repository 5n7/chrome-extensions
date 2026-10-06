import { isRecord } from "./is-record";

/** Matched by physical key (`code`), so Shift or an IME never changes which key it is. */
export type KeyCombination = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "metaKey" | "shiftKey"
>;

export type Direction = "down" | "up";

export interface Shortcuts {
  speedDown: KeyCombination;
  speedUp: KeyCombination;
}

const MODIFIER_CODES = new Set([
  "AltLeft",
  "AltRight",
  "ControlLeft",
  "ControlRight",
  "MetaLeft",
  "MetaRight",
  "ShiftLeft",
  "ShiftRight",
]);

const KEY_LABELS: Record<string, string> = {
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  Backquote: "`",
  Backslash: "\\",
  BracketLeft: "[",
  BracketRight: "]",
  Comma: ",",
  Equal: "=",
  Minus: "-",
  Period: ".",
  Quote: "'",
  Semicolon: ";",
  Slash: "/",
};

export function combination(code: string, modifiers: Partial<KeyCombination> = {}): KeyCombination {
  return { altKey: false, code, ctrlKey: false, metaKey: false, shiftKey: false, ...modifiers };
}

export const DEFAULT_SHORTCUTS: Shortcuts = {
  speedDown: combination("KeyS"),
  speedUp: combination("KeyD"),
};

/**
 * YouTube's own `<` and `>`, which step the Speed too unless a Speed Shortcut takes them. Matched
 * by the character typed, as YouTube does, since they sit on different keys across layouts.
 */
const NATIVE_DIRECTIONS: Record<string, Direction> = { "<": "down", ">": "up" };

export function toKeyCombination(event: KeyCombination): KeyCombination {
  return combination(event.code, {
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  });
}

export function isModifierKey(event: Pick<KeyboardEvent, "code">): boolean {
  return MODIFIER_CODES.has(event.code);
}

export function isSameCombination(a: KeyCombination, b: KeyCombination): boolean {
  return (
    a.code === b.code &&
    a.altKey === b.altKey &&
    a.ctrlKey === b.ctrlKey &&
    a.metaKey === b.metaKey &&
    a.shiftKey === b.shiftKey
  );
}

/** The Speed Shortcut a key press triggers, checking the viewer's own before YouTube's. */
export function findDirection(
  shortcuts: Shortcuts,
  event: KeyCombination & Pick<KeyboardEvent, "key">,
): Direction | undefined {
  if (isSameCombination(shortcuts.speedDown, event)) return "down";
  if (isSameCombination(shortcuts.speedUp, event)) return "up";
  if (event.altKey || event.ctrlKey || event.metaKey) return undefined;
  return NATIVE_DIRECTIONS[event.key];
}

function isKeyCombination(value: unknown): value is KeyCombination {
  return (
    isRecord(value) &&
    typeof value.code === "string" &&
    typeof value.altKey === "boolean" &&
    typeof value.ctrlKey === "boolean" &&
    typeof value.metaKey === "boolean" &&
    typeof value.shiftKey === "boolean"
  );
}

/** Falls back to the defaults unless both Speed Shortcuts are well-formed. */
export function readShortcuts(stored: unknown): Shortcuts {
  if (!isRecord(stored)) return DEFAULT_SHORTCUTS;
  const { speedDown, speedUp } = stored;
  if (!isKeyCombination(speedDown) || !isKeyCombination(speedUp)) return DEFAULT_SHORTCUTS;
  return { speedDown: toKeyCombination(speedDown), speedUp: toKeyCombination(speedUp) };
}

function formatKey(code: string): string {
  if (code === "Space") return "Space";
  return KEY_LABELS[code] ?? code.replace(/^(Key|Digit|Numpad)/, "");
}

export function formatCombination(combo: KeyCombination): string[] {
  return [
    combo.ctrlKey && "Ctrl",
    combo.altKey && "Alt",
    combo.shiftKey && "Shift",
    combo.metaKey && "Meta",
    formatKey(combo.code),
  ].filter((part) => typeof part === "string");
}
