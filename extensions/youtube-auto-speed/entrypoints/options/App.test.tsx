// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { saveSetting } from "@/utils/settings";

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

function button(name: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find(
    (each) => (each.getAttribute("aria-label") ?? each.textContent) === name,
  );
  if (!found) throw new Error(`no button ${name}`);
  return found;
}

function titlePatterns(): string[] {
  return [...document.querySelectorAll<HTMLInputElement>('input[placeholder="ASMR|relaxing"]')].map(
    (input) => input.value,
  );
}

function defaultSpeed(): string | undefined {
  return document.querySelector<HTMLInputElement>('input[name="default-speed"]:checked')?.value;
}

const RATE_LIMITED = "Couldn't save: Chrome limits how often settings sync. Try again later.";

/** Adds a title rule whose save sync storage refuses. */
async function addUnsavedTitleRule() {
  vi.spyOn(fakeBrowser.storage.sync, "set").mockRejectedValueOnce(
    new Error("MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded"),
  );
  await act(async () => button("Add title rule").click());
  expect(titlePatterns()).toEqual([""]);
  expect(document.body.textContent).toContain(RATE_LIMITED);
}

describe("options page", () => {
  it("keeps an edit whose save failed on screen while another setting changes", async () => {
    await addUnsavedTitleRule();
    await act(() => saveSetting("defaultSpeed", 2));
    expect(defaultSpeed()).toBe("2");
    expect(titlePatterns()).toEqual([""]);
    expect(document.body.textContent).toContain(RATE_LIMITED);
  });

  it("drops that edit and its failure once the same setting is saved elsewhere", async () => {
    await addUnsavedTitleRule();
    await act(() => saveSetting("titleRules", [{ id: "t", pattern: "asmr", speed: 0.5 }]));
    expect(titlePatterns()).toEqual(["asmr"]);
    expect(document.body.textContent).not.toContain(RATE_LIMITED);
  });
});
