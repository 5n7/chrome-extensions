// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { App } from "./App";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;

async function render(shortcuts: Record<string, string>) {
  vi.spyOn(fakeBrowser.commands, "getAll").mockImplementation(async () =>
    Object.entries(shortcuts).map(([name, shortcut]) => ({
      description: `About ${name}`,
      name,
      shortcut,
    })),
  );
  const container = document.body.appendChild(document.createElement("div"));
  root = createRoot(container);
  await act(async () => root?.render(<App />));
  return container;
}

function rows(container: HTMLElement) {
  return [...container.querySelectorAll("ul > li")].map((row) => {
    const keys = [...row.querySelectorAll("kbd")].map((kbd) => kbd.textContent);
    return [
      row.firstElementChild?.textContent,
      keys.length ? keys : row.lastElementChild?.textContent,
    ];
  });
}

describe("App", () => {
  afterEach(() => {
    act(() => root?.unmount());
    document.body.replaceChildren();
    vi.restoreAllMocks();
    fakeBrowser.reset();
  });

  it("lists the Walk commands in binding order, skipping the popup's own command", async () => {
    const container = await render({
      _execute_action: "Alt+Shift+R",
      "walk-newer": "",
      "walk-older": "⌃⇥",
    });
    expect(rows(container)).toEqual([
      ["About walk-older", ["⌃", "⇥"]],
      ["About walk-newer", "Not set"],
    ]);
  });

  it("asks for a copy by hand once the clipboard refuses the code", async () => {
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Denied"));
    const container = await render({ "walk-newer": "", "walk-older": "" });
    expect(container.querySelector("[role=alert]")).toBeNull();
    const button = container.querySelector("button");
    await act(async () => button?.click());
    expect(container.querySelector("[role=alert]")?.textContent).toBe(
      "Couldn't copy. Copy the code below yourself, then open the page.",
    );
    expect(button?.textContent).toBe("Open the shortcuts page");
  });
});
