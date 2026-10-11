// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensurePlayerButton, removePlayerButton } from "./player-button";

let slot: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = `<div class="controls"><div id="gear"></div></div>`;
  slot = document.getElementById("gear")!;
});

const button = () => document.querySelector("button");

describe("ensurePlayerButton", () => {
  it("puts a toggle before the slot that shows whether Danmaku is on", () => {
    const onToggle = vi.fn();
    ensurePlayerButton(slot, true, onToggle);
    expect(button()?.nextElementSibling).toBe(slot);
    expect(button()?.getAttribute("aria-pressed")).toBe("true");
    expect(button()?.innerHTML).toMatchInlineSnapshot(
      `"<svg aria-hidden="true" fill="none" height="20" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 20 20" width="20"><path d="M6 4h9a2.5 2.5 0 012.5 2.5v4A2.5 2.5 0 0115 13h-4l-3.5 3v-3H6a2.5 2.5 0 01-2.5-2.5v-4A2.5 2.5 0 016 4z"></path><path d="M1 7.5h1M1 10h1.2"></path><path d="M7.5 8.5h6"></path></svg>"`,
    );
    button()?.click();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("strikes the icon through while Danmaku is off", () => {
    ensurePlayerButton(slot, true, () => {});
    ensurePlayerButton(slot, false, () => {});
    expect(document.querySelectorAll("button")).toHaveLength(1);
    expect(button()?.getAttribute("aria-label")).toBe("Show danmaku");
    expect(button()?.innerHTML).toMatchInlineSnapshot(
      `"<svg aria-hidden="true" fill="none" height="20" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 20 20" width="20"><path d="M6 4h9a2.5 2.5 0 012.5 2.5v4A2.5 2.5 0 0115 13h-4l-3.5 3v-3H6a2.5 2.5 0 01-2.5-2.5v-4A2.5 2.5 0 016 4z"></path><path d="M1 7.5h1M1 10h1.2"></path><path d="M3.5 16.5L16.5 3.5"></path><path d="M5 17.5L17.5 5" stroke="rgba(0,0,0,.6)" stroke-width="1.4"></path></svg>"`,
    );
  });

  it("is removed with removePlayerButton", () => {
    ensurePlayerButton(slot, true, () => {});
    removePlayerButton(document);
    expect(button()).toBeNull();
  });
});
