// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { ContentScriptContext } from "wxt/utils/content-script-context";

import {
  combination,
  combinationId,
  formatCombination,
  interceptKeys,
  isRecordableKey,
  isSameCombination,
  ownsKeyboard,
  toKeyCombination,
} from "./keyboard";

describe("toKeyCombination", () => {
  it("keeps only the key and its modifiers from a keyboard event", () => {
    const event = { ...combination("KeyJ", { shiftKey: true }), key: "J", repeat: true };
    expect(toKeyCombination(event)).toEqual(combination("KeyJ", { shiftKey: true }));
  });
});

describe("isSameCombination", () => {
  it("tells Key Combinations apart by their exact modifiers", () => {
    const shiftLeft = combination("ArrowLeft", { shiftKey: true });
    expect(isSameCombination(shiftLeft, combination("ArrowLeft", { shiftKey: true }))).toBe(true);
    expect(isSameCombination(shiftLeft, combination("ArrowLeft"))).toBe(false);
    expect(isSameCombination(shiftLeft, combination("ArrowRight", { shiftKey: true }))).toBe(false);
  });
});

describe("isRecordableKey", () => {
  it("waits past lone modifiers, Tab, Caps Lock, and codes that name no key", () => {
    const waits = [
      "ShiftLeft",
      "MetaRight",
      "ControlLeft",
      "AltRight",
      "Tab",
      "CapsLock",
      "",
      "Unidentified",
    ];
    expect(waits.map((code) => isRecordableKey({ code }))).toEqual(waits.map(() => false));
    expect(["KeyK", "Escape", "Space", "Numpad5"].map((code) => isRecordableKey({ code }))).toEqual(
      [true, true, true, true],
    );
  });
});

describe("formatCombination", () => {
  it("lists the modifiers in a fixed order, then the key as printed on it", () => {
    expect(formatCombination(combination("ArrowRight", { shiftKey: true }))).toEqual([
      "Shift",
      "→",
    ]);
    expect(formatCombination(combination("KeyJ", { ctrlKey: true, metaKey: true }))).toEqual([
      "Ctrl",
      "Meta",
      "J",
    ]);
    expect(formatCombination(combination("Digit5"))).toEqual(["5"]);
    expect(formatCombination(combination("Numpad5"))).toEqual(["5"]);
    expect(formatCombination(combination("BracketLeft"))).toEqual(["["]);
    expect(formatCombination(combination("Comma"))).toEqual([","]);
    expect(formatCombination(combination("Slash"))).toEqual(["/"]);
    expect(formatCombination(combination("Space"))).toEqual(["Space"]);
  });
});

describe("combinationId", () => {
  it("tells apart Key Combinations whose labels read alike", () => {
    expect(combinationId(combination("Digit5"))).not.toBe(combinationId(combination("Numpad5")));
    expect(combinationId(combination("Enter"))).not.toBe(combinationId(combination("NumpadEnter")));
    expect(combinationId(combination("KeyJ"))).not.toBe(
      combinationId(combination("KeyJ", { shiftKey: true })),
    );
    expect(combinationId(combination("KeyJ", { shiftKey: true }))).toBe(
      combinationId(combination("KeyJ", { shiftKey: true })),
    );
  });
});

describe("ownsKeyboard", () => {
  function press(target: HTMLElement, init: KeyboardEventInit = {}): boolean | undefined {
    document.body.append(target);
    let owned: boolean | undefined;
    target.addEventListener("keydown", (event) => (owned = ownsKeyboard(event)), { once: true });
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, code: "KeyJ", ...init }));
    target.remove();
    return owned;
  }

  function input(type?: string): HTMLInputElement {
    const element = document.createElement("input");
    if (type) element.type = type;
    return element;
  }

  it("leaves keys to text fields, sliders, selects, and editable content", () => {
    expect(press(input())).toBe(true);
    expect(press(input("text"))).toBe(true);
    expect(press(input("search"))).toBe(true);
    expect(press(input("range"))).toBe(true);
    expect(press(document.createElement("textarea"))).toBe(true);
    expect(press(document.createElement("select"))).toBe(true);
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect(press(editable)).toBe(true);
  });

  it("leaves keys to an IME composition", () => {
    expect(press(document.createElement("div"), { isComposing: true })).toBe(true);
    expect(press(document.createElement("div"), { key: "Process" })).toBe(true);
  });

  it("takes keys from the page and keyless controls", () => {
    expect(press(document.createElement("div"))).toBe(false);
    expect(press(document.createElement("button"))).toBe(false);
    expect(press(input("checkbox"))).toBe(false);
  });
});

describe("interceptKeys", () => {
  let ctx: ContentScriptContext;
  let taken: string[];

  beforeEach(() => {
    fakeBrowser.reset();
    taken = [];
    ctx = new ContentScriptContext("test");
    interceptKeys(ctx, (event) => {
      if (event.code !== "KeyJ") return;
      return () => taken.push(event.code);
    });
  });

  afterEach(() => {
    ctx.notifyInvalidated();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  /** Dispatches the key on `target` and returns whether the page's own listener still saw it. */
  function press(type: "keydown" | "keyup", code: string, target: EventTarget = document.body) {
    const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, code });
    let reachedPage = false;
    const page = () => (reachedPage = true);
    window.addEventListener(type, page);
    target.dispatchEvent(event);
    window.removeEventListener(type, page);
    return { prevented: event.defaultPrevented, reachedPage };
  }

  it("takes a matched key before the page sees it, and hides its keyup too", () => {
    expect(press("keydown", "KeyJ")).toEqual({ prevented: true, reachedPage: false });
    expect(taken).toEqual(["KeyJ"]);
    expect(press("keyup", "KeyJ")).toEqual({ prevented: true, reachedPage: false });
    expect(press("keyup", "KeyJ")).toEqual({ prevented: false, reachedPage: true });
  });

  it("leaves an unmatched key to the page, keyup included", () => {
    expect(press("keydown", "KeyK")).toEqual({ prevented: false, reachedPage: true });
    expect(press("keyup", "KeyK")).toEqual({ prevented: false, reachedPage: true });
    expect(taken).toEqual([]);
  });

  it("never offers a key typed into a field", () => {
    const field = document.body.appendChild(document.createElement("textarea"));
    expect(press("keydown", "KeyJ", field)).toEqual({ prevented: false, reachedPage: true });
    expect(taken).toEqual([]);
  });

  it("forgets the taken keys once the window loses focus", () => {
    press("keydown", "KeyJ");
    window.dispatchEvent(new Event("blur"));
    expect(press("keyup", "KeyJ")).toEqual({ prevented: false, reachedPage: true });
  });
});
