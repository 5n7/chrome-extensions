// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { isSeekablePath, ownsKeyboard, seekTarget } from "./player";

describe("isSeekablePath", () => {
  it("matches VODs and clips", () => {
    expect(isSeekablePath("/videos/123456")).toBe(true);
    expect(isSeekablePath("/videos/123456/")).toBe(true);
    expect(isSeekablePath("/somechannel/clip/FunnyClipSlug-abc")).toBe(true);
  });

  it("rejects live channels and other pages", () => {
    expect(isSeekablePath("/somechannel")).toBe(false);
    expect(isSeekablePath("/somechannel/videos")).toBe(false);
    expect(isSeekablePath("/videos/abc")).toBe(false);
    expect(isSeekablePath("/somechannel/clip/slug/extra")).toBe(false);
    expect(isSeekablePath("/directory")).toBe(false);
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

  function input(type: string): HTMLInputElement {
    const element = document.createElement("input");
    element.type = type;
    return element;
  }

  it("leaves keys to text fields, sliders, and editable content", () => {
    expect(press(input("text"))).toBe(true);
    expect(press(input("search"))).toBe(true);
    expect(press(input("range"))).toBe(true);
    expect(press(document.createElement("textarea"))).toBe(true);
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

describe("seekTarget", () => {
  it("moves by the Seek Offset", () => {
    expect(seekTarget(100, 600, { direction: "backward", seconds: 5 })).toBe(95);
    expect(seekTarget(100, 600, { direction: "forward", seconds: 60 })).toBe(160);
  });

  it("stays inside the video", () => {
    expect(seekTarget(3, 600, { direction: "backward", seconds: 10 })).toBe(0.001);
    expect(seekTarget(595, 600, { direction: "forward", seconds: 10 })).toBe(599);
  });

  it("never steps back on a forward seek near the end", () => {
    expect(seekTarget(599.5, 600, { direction: "forward", seconds: 10 })).toBe(599.5);
    expect(seekTarget(0.5, 0.8, { direction: "forward", seconds: 5 })).toBe(0.5);
  });
});
