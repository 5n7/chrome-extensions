// @vitest-environment happy-dom
import { combination } from "@repo/wxt-kit/keyboard";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { DEFAULT_BINDINGS, seekBindings } from "@/utils/seek-bindings";

import { App } from "./App";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLElement;
let root: Root;

beforeEach(async () => {
  fakeBrowser.reset();
  // Reduced motion skips the animations, whose canceled promises happy-dom leaves rejected and unhandled.
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  container = document.body.appendChild(document.createElement("div"));
  root = createRoot(container);
  await act(async () => root.render(<App />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (candidate) => (candidate.getAttribute("aria-label") ?? candidate.textContent) === name,
  );
  if (!found) throw new Error(`No button named "${name}"`);
  return found;
}

async function click(target: HTMLElement) {
  await act(async () => target.click());
}

async function keyDown(target: EventTarget, init: KeyboardEventInit): Promise<KeyboardEvent> {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  await act(async () => {
    target.dispatchEvent(event);
  });
  return event;
}

describe("direction switch", () => {
  it("flips the Seek Offset's direction and names the new one", async () => {
    await click(button("back: ← seeks backward, switch to forward"));
    expect((await seekBindings.getValue())[0]?.offset).toEqual({
      direction: "forward",
      seconds: 5,
    });
    await click(button("ahead: ← seeks forward, switch to backward"));
    expect((await seekBindings.getValue())[0]?.offset).toEqual({
      direction: "backward",
      seconds: 5,
    });
  });
});

describe("recording", () => {
  it("adds the pressed Key Combination as a forward 10 s Seek Binding", async () => {
    const add = button("Add a key");
    await click(add);
    expect((await keyDown(add, { code: "KeyK", key: "k", shiftKey: true })).defaultPrevented).toBe(
      true,
    );
    expect((await seekBindings.getValue()).at(-1)).toEqual({
      combination: combination("KeyK", { shiftKey: true }),
      offset: { direction: "forward", seconds: 10 },
    });
  });

  it("waits past Tab and Caps Lock, leaving Tab to move focus", async () => {
    const add = button("Add a key");
    await click(add);
    expect((await keyDown(add, { code: "Tab", key: "Tab" })).defaultPrevented).toBe(false);
    expect((await keyDown(add, { code: "CapsLock", key: "CapsLock" })).defaultPrevented).toBe(
      false,
    );
    expect((await keyDown(add, { code: "KeyK", key: "k" })).defaultPrevented).toBe(true);
    const bindings = await seekBindings.getValue();
    expect(bindings).toHaveLength(DEFAULT_BINDINGS.length + 1);
    expect(bindings.at(-1)?.combination).toEqual(combination("KeyK"));
  });

  it("stops once focus leaves the button, so a key pressed elsewhere stays there", async () => {
    const add = button("Add a key");
    await act(async () => add.focus());
    await click(add);
    const elsewhere = button("back: ← seeks backward, switch to forward");
    await act(async () => elsewhere.focus());
    expect((await keyDown(elsewhere, { code: "KeyK", key: "k" })).defaultPrevented).toBe(false);
    expect(await seekBindings.getValue()).toEqual(DEFAULT_BINDINGS);
    expect(add.textContent).toBe("Add a key");
  });
});

describe("binding rows", () => {
  it("highlights only the pressed Key Combination, though 5 and numpad 5 read alike", async () => {
    await act(() =>
      seekBindings.setValue([
        { combination: combination("Digit5"), offset: { direction: "backward", seconds: 5 } },
        { combination: combination("Numpad5"), offset: { direction: "forward", seconds: 5 } },
      ]),
    );
    await keyDown(document.body, { code: "Numpad5", key: "5" });
    const pressed = [...container.querySelectorAll("li")].map((row) =>
      row.querySelector("kbd")?.classList.contains("text-white"),
    );
    expect(pressed).toEqual([false, true]);
  });
});

describe("seconds field", () => {
  async function typeSeconds(value: string): Promise<HTMLInputElement> {
    const input = container.querySelector<HTMLInputElement>('input[aria-label^="Seconds for ←,"]');
    if (!input) throw new Error("No seconds field for ←");
    await act(async () => {
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    return input;
  }

  it("saves a typed value on Enter", async () => {
    const input = await typeSeconds("45");
    await keyDown(input, { key: "Enter" });
    expect(document.activeElement).not.toBe(input);
    expect((await seekBindings.getValue())[0]?.offset.seconds).toBe(45);
  });

  it("keeps typing through the Enter that confirms an IME conversion", async () => {
    const input = await typeSeconds("45");
    await keyDown(input, { isComposing: true, key: "Enter" });
    expect(document.activeElement).toBe(input);
    expect((await seekBindings.getValue())[0]?.offset.seconds).toBe(5);
  });
});
