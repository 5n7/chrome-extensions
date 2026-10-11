import type { ContentScriptContext } from "wxt/utils/content-script-context";

/** Matched by physical key (`code`), so Shift or an IME never changes which key it is. */
export type KeyCombination = Pick<
  KeyboardEvent,
  "altKey" | "code" | "ctrlKey" | "metaKey" | "shiftKey"
>;

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

// Recording waits past these as it does past modifiers: Tab so the keyboard can still leave, Caps
// Lock because it only toggles case, and codes some virtual keyboards send instead of a real key.
const UNRECORDABLE_CODES = new Set(["", "CapsLock", "Tab", "Unidentified"]);

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

// Inputs that ignore arrow and letter keys, so a Key Combination may take them over.
// Text fields, sliders such as a volume control, and radio groups keep their keys.
const KEYLESS_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "reset",
  "submit",
]);

export function combination(code: string, modifiers: Partial<KeyCombination> = {}): KeyCombination {
  return { altKey: false, code, ctrlKey: false, metaKey: false, shiftKey: false, ...modifiers };
}

export function toKeyCombination(event: KeyCombination): KeyCombination {
  return combination(event.code, {
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
  });
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

/** Whether a key press can end a recording; a lone modifier or a key that stands for none waits. */
export function isRecordableKey(event: Pick<KeyboardEvent, "code">): boolean {
  return !MODIFIER_CODES.has(event.code) && !UNRECORDABLE_CODES.has(event.code);
}

/** The key as printed on it, so `BracketLeft` reads `[` and `Numpad5` reads `5`. */
function formatKey(code: string): string {
  return KEY_LABELS[code] ?? code.replace(/^(Key|Digit|Numpad)/, "");
}

function modifierLabels(combo: KeyCombination): string[] {
  return [
    combo.ctrlKey && "Ctrl",
    combo.altKey && "Alt",
    combo.shiftKey && "Shift",
    combo.metaKey && "Meta",
  ].filter((part) => typeof part === "string");
}

/** The held modifiers in a fixed order, then the key; each UI joins or draws the parts its own way. */
export function formatCombination(combo: KeyCombination): string[] {
  return [...modifierLabels(combo), formatKey(combo.code)];
}

/**
 * Names the Key Combination by its code, not its label, for a React key or a lookup: `5` and
 * numpad `5` read alike but are different Key Combinations.
 */
export function combinationId(combo: KeyCombination): string {
  return [...modifierLabels(combo), combo.code].join("+");
}

/** Whether the key belongs to the focused control or an IME composition rather than the page. */
export function ownsKeyboard(event: KeyboardEvent): boolean {
  if (event.isComposing || event.key === "Process") return true;
  const target = event.composedPath()[0];
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && !KEYLESS_INPUT_TYPES.has(target.type);
}

/**
 * Takes over key presses before the page sees them. `match` returns what to do instead, or nothing
 * to leave the key to the page; a key that belongs to a focused control or an IME is never offered.
 * Capture on `window` runs before the page's own handlers, and the taken key's keyup is hidden too.
 */
export function interceptKeys(
  ctx: ContentScriptContext,
  match: (event: KeyboardEvent) => (() => void) | undefined,
): void {
  // Codes whose keydown was taken over, so only their keyup is hidden from the page too.
  const intercepted = new Set<string>();
  ctx.addEventListener(
    window,
    "keydown",
    (event) => {
      if (ownsKeyboard(event)) return;
      const takeOver = match(event);
      if (!takeOver) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      intercepted.add(event.code);
      takeOver();
    },
    { capture: true },
  );
  ctx.addEventListener(
    window,
    "keyup",
    (event) => {
      if (!intercepted.delete(event.code)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { capture: true },
  );
  // A keyup never arrives after the window loses focus, or on macOS while Meta is held.
  ctx.addEventListener(window, "blur", () => intercepted.clear());
}
