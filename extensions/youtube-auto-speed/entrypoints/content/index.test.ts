// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { ContentScriptContext } from "wxt/utils/content-script-context";

import type { Browser } from "#imports";
import { POPUP_PORT, type PageState, type PickedMessage } from "@/utils/page-state";
import {
  REQUEST_EVENT,
  RESPONSE_EVENT,
  type PlayerDetails,
  type PlayerReport,
  type PlayerVideo,
} from "@/utils/player-bridge";
import type { ChannelRule } from "@/utils/rules";
import { saveSetting } from "@/utils/settings";
import type { Speed } from "@/utils/speed";

import contentScript from "./index";

const shown = vi.hoisted((): { speed: number; nudge: boolean }[] => []);
vi.mock("@/utils/speed-indicator", () => ({
  createSpeedIndicator: () => ({
    show: (_player: HTMLElement, speed: number, nudge = false) => shown.push({ nudge, speed }),
    hide() {},
    remove() {},
  }),
}));

function fakeEvent<A extends unknown[]>() {
  const listeners = new Set<(...args: A) => void>();
  const event: Browser.events.Event<(...args: A) => void> = {
    addListener: (listener) => void listeners.add(listener),
    addRules() {},
    getRules() {},
    hasListener: (listener) => listeners.has(listener),
    hasListeners: () => listeners.size > 0,
    removeListener: (listener) => void listeners.delete(listener),
    removeRules() {},
  };
  return { event, fire: (...args: A) => listeners.forEach((each) => each(...args)) };
}

let connect = fakeEvent<[Browser.runtime.Port]>();

function openPopup() {
  const received: PageState[] = [];
  const disconnect = fakeEvent<[Browser.runtime.Port]>();
  const message = fakeEvent<[PickedMessage, Browser.runtime.Port]>();
  const port: Browser.runtime.Port = {
    disconnect() {},
    name: POPUP_PORT,
    onDisconnect: disconnect.event,
    onMessage: message.event,
    postMessage: (state: PageState) => received.push(state),
  };
  connect.fire(port);
  return {
    get last() {
      return received.at(-1);
    },
    async picked() {
      message.fire({ kind: "picked" }, port);
      await vi.advanceTimersByTimeAsync(0);
    },
  };
}

const LISP_VIDEO: PlayerVideo = {
  author: "Daily Lisp Talks",
  isLive: false,
  title: "Macros",
  videoId: "abc",
};
const LISP_DETAILS: PlayerDetails = {
  isLive: false,
  ownerUrl: "http://www.youtube.com/@DailyLisp",
  videoId: "abc",
};
const LISP: PlayerReport = { details: LISP_DETAILS, video: LISP_VIDEO };
const LISP_RULE: ChannelRule = { handle: "@dailylisp", id: "c", speed: 2 };

let report: PlayerReport = {};
const answer = () => {
  document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: JSON.stringify(report) }));
};

let ctx: ContentScriptContext;

async function start(next: PlayerReport, { ad = false } = {}) {
  history.replaceState(null, "", "/watch?v=abc");
  document.body.innerHTML = `<div id="movie_player" class="${ad ? "ad-showing" : ""}"><video class="html5-main-video"></video></div>`;
  report = next;
  ctx = new ContentScriptContext("content");
  await contentScript.main(ctx);
}

function player(): HTMLElement {
  const element = document.querySelector<HTMLElement>("#movie_player");
  if (!element) throw new Error("no player");
  return element;
}

function video(): HTMLVideoElement {
  const element = document.querySelector("video");
  if (!element) throw new Error("no video");
  return element;
}

async function navigate(path: string, next: PlayerReport) {
  history.replaceState(null, "", path);
  report = next;
  document.dispatchEvent(new Event("yt-navigate-finish"));
  await vi.advanceTimersByTimeAsync(0);
}

function press(code: string, key: string) {
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, cancelable: true, code, key }),
  );
}

function ready(speed: Speed, source: Extract<PageState, { kind: "ready" }>["source"]): PageState {
  return { channelName: "Daily Lisp Talks", handle: "@DailyLisp", kind: "ready", source, speed };
}

beforeEach(() => {
  fakeBrowser.reset();
  connect = fakeEvent();
  const { onConnect } = fakeBrowser.runtime;
  vi.spyOn(onConnect, "addListener").mockImplementation((each) => connect.event.addListener(each));
  vi.spyOn(onConnect, "removeListener").mockImplementation((each) =>
    connect.event.removeListener(each),
  );
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  document.addEventListener(REQUEST_EVENT, answer);
  shown.length = 0;
});

afterEach(() => {
  ctx.notifyInvalidated();
  document.removeEventListener(REQUEST_EVENT, answer);
  document.body.innerHTML = "";
  history.replaceState(null, "", "/");
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("content script", () => {
  it("plays a Target Video at its Rule Speed and tells the popup why", async () => {
    await saveSetting("channelRules", [LISP_RULE]);
    await start(LISP);
    expect(video().playbackRate).toBe(2);
    expect(openPopup().last).toEqual(ready(2, { handle: "@dailylisp", kind: "channel" }));
    await vi.advanceTimersByTimeAsync(3000);
    expect(shown).toEqual([{ nudge: false, speed: 2 }]);
  });

  it("leaves a live stream alone, even while an ad plays before it", async () => {
    await saveSetting("defaultSpeed", 2);
    await start({ ...LISP, video: { ...LISP_VIDEO, isLive: true } });
    expect(video().playbackRate).toBe(1);
    expect(openPopup().last).toEqual({ kind: "none" });

    player().classList.add("ad-showing");
    await navigate("/watch?v=abc", {
      details: { ...LISP_DETAILS, isLive: true },
      video: { author: "Ad", isLive: false, title: "Buy", videoId: "ad123" },
    });
    expect(video().playbackRate).toBe(1);
    expect(shown).toEqual([]);
  });

  it("steps the Speed with Speed Shortcuts, nudging the indicator at a limit", async () => {
    await saveSetting("channelRules", [{ ...LISP_RULE, speed: 2.5 }]);
    await start(LISP);
    const popup = openPopup();
    press("KeyD", "d");
    expect(video().playbackRate).toBe(3);
    expect(popup.last).toEqual(ready(3, { kind: "manual" }));
    press("KeyD", "d");
    expect(video().playbackRate).toBe(3);
    expect(shown).toEqual([
      { nudge: false, speed: 2.5 },
      { nudge: false, speed: 3 },
      { nudge: true, speed: 3 },
    ]);
  });

  it("reverts an outside change to the rate once it settles, without showing the indicator", async () => {
    await saveSetting("channelRules", [LISP_RULE]);
    await start(LISP);
    video().playbackRate = 1;
    video().dispatchEvent(new Event("ratechange"));
    await vi.advanceTimersByTimeAsync(99);
    expect(video().playbackRate).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(video().playbackRate).toBe(2);
    expect(shown).toEqual([{ nudge: false, speed: 2 }]);
  });

  it("also reverts a rate changed without a ratechange it heard, at its next look", async () => {
    await saveSetting("channelRules", [LISP_RULE]);
    await start(LISP);
    video().playbackRate = 1;
    await vi.advanceTimersByTimeAsync(1000);
    expect(video().playbackRate).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(video().playbackRate).toBe(2);
    expect(shown).toEqual([{ nudge: false, speed: 2 }]);
  });

  it("plays the ads before a Target Video at its Speed, and times out reading it after them", async () => {
    await saveSetting("defaultSpeed", 1.5);
    const ad: PlayerReport = { video: { author: "", isLive: false, title: "", videoId: "ad123" } };
    await start(ad, { ad: true });
    expect(video().playbackRate).toBe(1.5);
    const popup = openPopup();
    await vi.advanceTimersByTimeAsync(6000);
    expect(popup.last).toEqual({ kind: "loading" });

    player().classList.remove("ad-showing");
    report = { video: { ...LISP_VIDEO, author: "" } };
    await vi.advanceTimersByTimeAsync(4900);
    expect(popup.last).toEqual({ kind: "loading" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(popup.last).toEqual({ kind: "unreadable" });
  });

  it("hands the player back at 1.0x once the Target Video is left", async () => {
    await saveSetting("channelRules", [LISP_RULE]);
    await start(LISP);
    const popup = openPopup();
    await navigate("/", {});
    expect(video().playbackRate).toBe(1);
    expect(popup.last).toEqual({ kind: "none" });
  });

  it("keeps a Manual Speed through a settings change that leaves the Rule Speed, until a pick", async () => {
    await saveSetting("channelRules", [LISP_RULE]);
    await start(LISP);
    const popup = openPopup();
    press("KeyD", "d");
    await saveSetting("titleRules", [{ id: "t", pattern: "asmr", speed: 0.5 }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(video().playbackRate).toBe(2.5);
    await popup.picked();
    expect(video().playbackRate).toBe(2);
    expect(popup.last).toEqual(ready(2, { handle: "@dailylisp", kind: "channel" }));
  });
});
