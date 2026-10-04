import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import {
  DEFAULT_BINDINGS,
  findSeekBinding,
  formatCombination,
  formatOffset,
  isValidSeconds,
  seekBindings,
  toKeyCombination,
  type KeyCombination,
} from "./seek-bindings";

const key = (code: string, modifiers: Partial<KeyCombination> = {}): KeyCombination => ({
  altKey: false,
  code,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...modifiers,
});

describe("seekBindings", () => {
  beforeEach(() => fakeBrowser.reset());

  it("starts with the Default Bindings", async () => {
    const bindings = await seekBindings.getValue();
    expect(
      bindings.map(
        (b) => `${formatCombination(b.combination).join("+")} ${formatOffset(b.offset)}`,
      ),
    ).toEqual([
      "← −5s",
      "→ +5s",
      "J −10s",
      "L +10s",
      "Shift+J −30s",
      "Shift+L +30s",
      "Shift+← −60s",
      "Shift+→ +60s",
    ]);
  });

  it("keeps an emptied list instead of falling back to the defaults", async () => {
    await seekBindings.setValue([]);
    expect(await seekBindings.getValue()).toEqual([]);
  });
});

describe("toKeyCombination", () => {
  it("keeps only the key and its modifiers from a keyboard event", () => {
    const event = { ...key("KeyJ", { shiftKey: true }), key: "J", repeat: true };
    expect(toKeyCombination(event)).toEqual(key("KeyJ", { shiftKey: true }));
  });
});

describe("findSeekBinding", () => {
  it("tells Key Combinations apart by their exact modifiers", () => {
    expect(findSeekBinding(DEFAULT_BINDINGS, key("ArrowLeft"))?.offset.seconds).toBe(5);
    expect(
      findSeekBinding(DEFAULT_BINDINGS, key("ArrowLeft", { shiftKey: true }))?.offset.seconds,
    ).toBe(60);
    expect(findSeekBinding(DEFAULT_BINDINGS, key("ArrowLeft", { altKey: true }))).toBeUndefined();
  });
});

describe("formatCombination", () => {
  it("labels modifiers and keys", () => {
    expect(formatCombination(key("ArrowRight", { shiftKey: true }))).toEqual(["Shift", "→"]);
    expect(formatCombination(key("KeyJ", { ctrlKey: true, metaKey: true }))).toEqual([
      "Ctrl",
      "Meta",
      "J",
    ]);
    expect(formatCombination(key("Digit5"))).toEqual(["5"]);
  });
});

describe("isValidSeconds", () => {
  it("accepts whole seconds from 1 to 3600", () => {
    expect([0, 1, 1.5, 3600, 3601].map(isValidSeconds)).toEqual([false, true, false, true, false]);
  });
});
