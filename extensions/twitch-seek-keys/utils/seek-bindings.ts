import { storage } from "#imports";

/** Matched by physical key (`code`), so Shift or an IME never changes which key it is. */
export type KeyCombination = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "metaKey" | "shiftKey"
>;

export interface SeekOffset {
  direction: "backward" | "forward";
  seconds: number;
}

export interface SeekBinding {
  combination: KeyCombination;
  offset: SeekOffset;
}

export const MIN_SECONDS = 1;
export const MAX_SECONDS = 3600;

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
};

function combination(code: string, modifiers: Partial<KeyCombination> = {}): KeyCombination {
  return { altKey: false, code, ctrlKey: false, metaKey: false, shiftKey: false, ...modifiers };
}

function binding(
  combo: KeyCombination,
  direction: SeekOffset["direction"],
  seconds: number,
): SeekBinding {
  return { combination: combo, offset: { direction, seconds } };
}

// Ordered from the finest to the coarsest step, backward before forward.
export const DEFAULT_BINDINGS: SeekBinding[] = [
  binding(combination("ArrowLeft"), "backward", 5),
  binding(combination("ArrowRight"), "forward", 5),
  binding(combination("KeyJ"), "backward", 10),
  binding(combination("KeyL"), "forward", 10),
  binding(combination("KeyJ", { shiftKey: true }), "backward", 30),
  binding(combination("KeyL", { shiftKey: true }), "forward", 30),
  binding(combination("ArrowLeft", { shiftKey: true }), "backward", 60),
  binding(combination("ArrowRight", { shiftKey: true }), "forward", 60),
];

export const seekBindings = storage.defineItem<SeekBinding[]>("sync:seekBindings", {
  fallback: DEFAULT_BINDINGS,
});

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

export function findSeekBinding(
  bindings: readonly SeekBinding[],
  event: KeyCombination,
): SeekBinding | undefined {
  return bindings.find((b) => isSameCombination(b.combination, event));
}

export function isValidSeconds(seconds: number): boolean {
  return Number.isInteger(seconds) && seconds >= MIN_SECONDS && seconds <= MAX_SECONDS;
}

export function formatKey(code: string): string {
  return KEY_LABELS[code] ?? code.replace(/^(Key|Digit)/, "");
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

export function formatOffset(offset: SeekOffset): string {
  return `${offset.direction === "backward" ? "−" : "+"}${offset.seconds}s`;
}
