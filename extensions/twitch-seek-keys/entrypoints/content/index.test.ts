// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { ContentScriptContext } from "wxt/utils/content-script-context";

import { seekBindings } from "@/utils/seek-bindings";

import contentScript from "./index";

let ctx: ContentScriptContext;

beforeEach(() => {
  fakeBrowser.reset();
  history.replaceState(null, "", "/videos/123456");
  document.body.innerHTML = "<video></video>";
  // happy-dom lays nothing out, so the one video is the largest by this size.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    DOMRect.fromRect({ height: 360, width: 640 }),
  );
  Object.defineProperty(video(), "duration", { value: 600 });
  video().currentTime = 100;
  ctx = new ContentScriptContext("content");
});

afterEach(() => {
  ctx.notifyInvalidated();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function video(): HTMLVideoElement {
  const element = document.querySelector("video");
  if (!element) throw new Error("no video");
  return element;
}

/** Dispatches the key on `target` and returns whether Twitch's own listener still saw it. */
function press(type: "keydown" | "keyup", code: string, target: EventTarget = document.body) {
  const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, code });
  let reachedTwitch = false;
  const twitch = () => (reachedTwitch = true);
  window.addEventListener(type, twitch);
  target.dispatchEvent(event);
  window.removeEventListener(type, twitch);
  return { prevented: event.defaultPrevented, reachedTwitch };
}

describe("content script", () => {
  it("seeks by a Seek Binding and hides the key from Twitch, its keyup included", async () => {
    await contentScript.main(ctx);
    expect(press("keydown", "ArrowLeft")).toEqual({ prevented: true, reachedTwitch: false });
    expect(video().currentTime).toBe(95);
    expect(press("keyup", "ArrowLeft")).toEqual({ prevented: true, reachedTwitch: false });
  });

  it("leaves an unbound key to Twitch, keyup included", async () => {
    await contentScript.main(ctx);
    expect(press("keydown", "KeyK")).toEqual({ prevented: false, reachedTwitch: true });
    expect(press("keyup", "KeyK")).toEqual({ prevented: false, reachedTwitch: true });
    expect(video().currentTime).toBe(100);
  });

  it("leaves keys typed into chat to Twitch", async () => {
    await contentScript.main(ctx);
    const chat = document.body.appendChild(document.createElement("textarea"));
    expect(press("keydown", "ArrowLeft", chat)).toEqual({ prevented: false, reachedTwitch: true });
    expect(video().currentTime).toBe(100);
  });

  it("stops hiding keyups once the window loses focus", async () => {
    await contentScript.main(ctx);
    press("keydown", "ArrowLeft");
    window.dispatchEvent(new Event("blur"));
    expect(press("keyup", "ArrowLeft")).toEqual({ prevented: false, reachedTwitch: true });
  });

  it("leaves live streams to Native Seek", async () => {
    history.replaceState(null, "", "/somechannel");
    await contentScript.main(ctx);
    expect(press("keydown", "ArrowLeft")).toEqual({ prevented: false, reachedTwitch: true });
    expect(video().currentTime).toBe(100);
  });

  it("follows Seek Bindings saved while it runs, and a change made while they load", async () => {
    const { promise: staleRead, resolve } = Promise.withResolvers<typeof seekBindings.fallback>();
    vi.spyOn(seekBindings, "getValue").mockReturnValueOnce(staleRead);
    const running = contentScript.main(ctx);
    const bound = (code: string, seconds: number) => ({
      combination: { altKey: false, code, ctrlKey: false, metaKey: false, shiftKey: false },
      offset: { direction: "forward" as const, seconds },
    });
    await seekBindings.setValue([bound("KeyK", 7)]);
    resolve(seekBindings.fallback);
    await running;
    press("keydown", "KeyK");
    expect(video().currentTime).toBe(107);
    await seekBindings.setValue([bound("KeyK", 20)]);
    press("keydown", "KeyK");
    expect(video().currentTime).toBe(127);
  });
});
