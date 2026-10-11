// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { getSettings } from "@/utils/settings";

import { App } from "./App";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root;

beforeEach(async () => {
  fakeBrowser.reset();
  root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root.render(<App />));
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function slider(id: string): HTMLInputElement {
  const found = document.querySelector<HTMLInputElement>(`input#${id}`);
  if (!found) throw new Error(`no slider ${id}`);
  return found;
}

async function click(name: string) {
  const found = [...document.querySelectorAll("button")].find((each) => each.textContent === name);
  if (!found) throw new Error(`no button ${name}`);
  await act(async () => found.click());
}

const shown = (id: string) => document.querySelector(`output[for="${id}"]`)?.textContent;

/** Moves the thumb, as a drag or a keyboard step does, firing `input`. */
async function move(input: HTMLInputElement, value: number) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      input,
      String(value),
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function fire(input: HTMLInputElement, event: Event) {
  await act(async () => {
    input.dispatchEvent(event);
  });
}

/** One keyboard step, which Chrome follows with `change` at once, auto-repeat included. */
async function keyStep(input: HTMLInputElement, value: number, repeat: boolean) {
  await fire(input, new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight", repeat }));
  await move(input, value);
  await fire(input, new Event("change", { bubbles: true }));
}

describe("sliders", () => {
  it("saves a held arrow key's steps once it is let go, previewing each step", async () => {
    const area = slider("area");
    const set = vi.spyOn(fakeBrowser.storage.sync, "set");
    await keyStep(area, 75, false);
    await keyStep(area, 80, true);
    await keyStep(area, 85, true);
    expect(shown("area")).toBe("Top 85%");
    expect(set).not.toHaveBeenCalled();
    await fire(area, new KeyboardEvent("keyup", { bubbles: true, key: "ArrowRight" }));
    expect(set).toHaveBeenCalledOnce();
    expect((await getSettings()).area).toBe(85);
  });

  it("saves keyboard steps when focus leaves before the key is let go", async () => {
    const area = slider("area");
    await keyStep(area, 75, false);
    await fire(area, new FocusEvent("blur"));
    expect((await getSettings()).area).toBe(75);
    await move(area, 90);
    await fire(area, new Event("change", { bubbles: true }));
    expect((await getSettings()).area).toBe(90);
  });

  it("saves a drag once the pointer lets go", async () => {
    const area = slider("area");
    const set = vi.spyOn(fakeBrowser.storage.sync, "set");
    await move(area, 60);
    await move(area, 50);
    expect(shown("area")).toBe("Top 50%");
    expect(set).not.toHaveBeenCalled();
    await fire(area, new Event("change", { bubbles: true }));
    expect(set).toHaveBeenCalledOnce();
    expect((await getSettings()).area).toBe(50);
  });
});

describe("reset", () => {
  it("names the sync limit that refused it", async () => {
    vi.spyOn(fakeBrowser.storage.sync, "remove").mockRejectedValueOnce(
      new Error("MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded"),
    );
    await click("Reset");
    await click("Reset everything?");
    expect(document.body.textContent).toContain(
      "Couldn't save: Chrome limits how often settings sync. Try again later.",
    );
  });
});
