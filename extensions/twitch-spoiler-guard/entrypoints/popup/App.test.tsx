// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { guard } from "@/utils/guard";

import { App } from "./App";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  fakeBrowser.reset();
  container = document.body.appendChild(document.createElement("div"));
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render(on: boolean): Promise<HTMLButtonElement> {
  await guard.setValue(on);
  await act(async () => root.render(<App />));
  const stamp = container.querySelector("button");
  if (!stamp) throw new Error("No stamp");
  return stamp;
}

async function dispatch<E extends Event>(target: EventTarget, event: E): Promise<E> {
  await act(async () => {
    target.dispatchEvent(event);
  });
  return event;
}

const pointer = (type: string) =>
  new PointerEvent(type, { bubbles: true, button: 0, cancelable: true, pointerId: 1 });
const key = (type: string, key: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent(type, { bubbles: true, cancelable: true, key, ...init });

async function click(stamp: HTMLElement) {
  await act(async () => stamp.click());
}

async function finishHold() {
  const ink = container.querySelector(".animate-ink-spread");
  if (!ink) throw new Error("No hold in progress");
  await dispatch(ink, new AnimationEvent("animationend", { bubbles: true }));
}

function status(): string | null | undefined {
  return container.querySelector('[role="status"]')?.textContent;
}

describe("stamp while the Guard is off", () => {
  it("turns the Guard on with one click", async () => {
    const stamp = await render(false);
    await dispatch(stamp, pointer("pointerdown"));
    await dispatch(stamp, pointer("pointerup"));
    await click(stamp);
    expect(await guard.getValue()).toBe(true);
    expect(status()).toBe("Guard is on.");
  });

  it("leaves Enter's keydown to click", async () => {
    const stamp = await render(false);
    expect((await dispatch(stamp, key("keydown", "Enter"))).defaultPrevented).toBe(false);
    expect(
      (await dispatch(stamp, key("keydown", "Enter", { repeat: true }))).defaultPrevented,
    ).toBe(true);
  });
});

describe("stamp while the Guard is on", () => {
  it("keeps the Guard on after a short press", async () => {
    const stamp = await render(true);
    await dispatch(stamp, pointer("pointerdown"));
    expect(status()).toBe("Keep holding to turn the Guard off.");
    await dispatch(stamp, pointer("pointerup"));
    await click(stamp);
    expect(await guard.getValue()).toBe(true);
    expect(status()).toBe("Guard is on.");
  });

  it("turns the Guard off after a full hold, and the click that ends it keeps it off", async () => {
    const stamp = await render(true);
    await dispatch(stamp, pointer("pointerdown"));
    await finishHold();
    expect(await guard.getValue()).toBe(false);
    await dispatch(stamp, pointer("pointerup"));
    await click(stamp);
    expect(await guard.getValue()).toBe(false);
    expect(status()).toBe("Guard is off.");
  });

  it("holds on Enter instead of clicking, and turns the Guard off once the hold is full", async () => {
    const stamp = await render(true);
    expect((await dispatch(stamp, key("keydown", "Enter"))).defaultPrevented).toBe(true);
    await finishHold();
    await dispatch(stamp, key("keyup", "Enter"));
    expect(await guard.getValue()).toBe(false);
  });

  it("forgets a full hold once its key is up, so a click without a press turns the Guard on", async () => {
    const stamp = await render(true);
    await dispatch(stamp, key("keydown", "Enter"));
    await finishHold();
    await dispatch(stamp, key("keyup", "Enter"));
    await click(stamp);
    expect(await guard.getValue()).toBe(true);
  });

  it("asks a click without a press to confirm, and a second one turns the Guard off", async () => {
    const stamp = await render(true);
    await click(stamp);
    expect(status()).toBe("Press again to turn the Guard off.");
    expect(await guard.getValue()).toBe(true);
    await click(stamp);
    expect(await guard.getValue()).toBe(false);
  });

  it("forgets a released hold key, so the next click without a press asks to confirm", async () => {
    const stamp = await render(true);
    await dispatch(stamp, key("keydown", " "));
    await dispatch(stamp, key("keyup", " "));
    await click(stamp);
    expect(status()).toBe("Press again to turn the Guard off.");
  });
});
