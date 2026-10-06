import { describe, expect, it } from "vitest";

import {
  combination,
  DEFAULT_SHORTCUTS,
  findDirection,
  formatCombination,
  readShortcuts,
} from "./shortcuts";

const press = (code: string, key: string, modifiers: Parameters<typeof combination>[1] = {}) => ({
  ...combination(code, modifiers),
  key,
});

describe("findDirection", () => {
  it("matches the exact Key Combination, modifiers included", () => {
    expect(findDirection(DEFAULT_SHORTCUTS, press("KeyS", "s"))).toBe("down");
    expect(findDirection(DEFAULT_SHORTCUTS, press("KeyD", "d"))).toBe("up");
    expect(
      findDirection(DEFAULT_SHORTCUTS, press("KeyS", "S", { shiftKey: true })),
    ).toBeUndefined();
    expect(findDirection(DEFAULT_SHORTCUTS, press("KeyS", "s", { ctrlKey: true }))).toBeUndefined();
  });

  it("treats YouTube's own < and > as Speed Shortcuts, on any layout", () => {
    expect(findDirection(DEFAULT_SHORTCUTS, press("Comma", "<", { shiftKey: true }))).toBe("down");
    expect(findDirection(DEFAULT_SHORTCUTS, press("Period", ">", { shiftKey: true }))).toBe("up");
    // German layout: `<` has a key of its own, and Shift+Comma types `;`.
    expect(findDirection(DEFAULT_SHORTCUTS, press("IntlBackslash", "<"))).toBe("down");
    expect(
      findDirection(DEFAULT_SHORTCUTS, press("Comma", ";", { shiftKey: true })),
    ).toBeUndefined();
    expect(
      findDirection(DEFAULT_SHORTCUTS, press("Comma", "<", { ctrlKey: true, shiftKey: true })),
    ).toBeUndefined();
  });

  it("lets a viewer's Key Combination take over YouTube's", () => {
    const shortcuts = { ...DEFAULT_SHORTCUTS, speedUp: combination("Comma", { shiftKey: true }) };
    expect(findDirection(shortcuts, press("Comma", "<", { shiftKey: true }))).toBe("up");
  });
});

describe("readShortcuts", () => {
  it("falls back to the defaults unless both are well-formed", () => {
    expect(readShortcuts(undefined)).toEqual(DEFAULT_SHORTCUTS);
    expect(readShortcuts({ speedDown: combination("KeyA") })).toEqual(DEFAULT_SHORTCUTS);
    const stored = { speedDown: combination("KeyA"), speedUp: combination("KeyB") };
    expect(readShortcuts(stored)).toEqual(stored);
  });
});

describe("formatCombination", () => {
  it("names keys the way they are printed", () => {
    expect(formatCombination(combination("KeyS", { shiftKey: true }))).toEqual(["Shift", "S"]);
    expect(formatCombination(combination("ArrowLeft"))).toEqual(["←"]);
    expect(formatCombination(combination("Comma"))).toEqual([","]);
  });
});
