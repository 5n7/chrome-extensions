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
import { channelName, channelNamesItem, saveSetting } from "@/utils/settings";
import type { Speed } from "@/utils/speed";
import { PLAYERS, type PlayerKind } from "@/utils/youtube";

import contentScript from "./index";

const shown = vi.hoisted((): { speed: number; nudge: boolean }[] => []);
const shownIn = vi.hoisted((): PlayerKind[] => []);
vi.mock("@/utils/speed-indicator", () => ({
  createSpeedIndicator: () => ({
    show(kind: PlayerKind, speed: number, nudge = false) {
      shown.push({ nudge, speed });
      shownIn.push(kind);
    },
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
    close: () => disconnect.fire(port),
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
let loadedIn: PlayerKind = "watch";
const answer = (event: Event) => {
  const reported = (event as CustomEvent<unknown>).detail === loadedIn ? report : {};
  document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: JSON.stringify(reported) }));
};

let ctx: ContentScriptContext;

const PAGES: Record<PlayerKind, string> = { shorts: "/shorts/abc", watch: "/watch?v=abc" };

async function start(
  next: PlayerReport,
  { ad = false, player = "watch" }: { ad?: boolean; player?: PlayerKind } = {},
) {
  history.replaceState(null, "", PAGES[player]);
  document.body.innerHTML = `
    <div id="movie_player"><video class="html5-main-video"></video></div>
    <div id="shorts-player"><video class="html5-main-video"></video></div>`;
  if (ad) playerElement(player).classList.add("ad-showing");
  report = next;
  loadedIn = player;
  ctx = new ContentScriptContext("content");
  await contentScript.main(ctx);
}

function playerElement(kind: PlayerKind = "watch"): HTMLElement {
  const element = document.querySelector<HTMLElement>(PLAYERS[kind].selector);
  if (!element) throw new Error("no player");
  return element;
}

function video(kind: PlayerKind = "watch"): HTMLVideoElement {
  const element = playerElement(kind).querySelector("video");
  if (!element) throw new Error("no video");
  return element;
}

async function navigate(path: string, next: PlayerReport, { player = loadedIn } = {}) {
  history.replaceState(null, "", path);
  report = next;
  loadedIn = player;
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
  shownIn.length = 0;
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

  it("plays a Short at its Rule Speed in the Shorts player, leaving the watch player alone", async () => {
    await saveSetting("channelRules", [LISP_RULE]);
    await start(LISP, { player: "shorts" });
    expect(video("shorts").playbackRate).toBe(2);
    expect(video("watch").playbackRate).toBe(1);
    expect(openPopup().last).toEqual(ready(2, { handle: "@dailylisp", kind: "channel" }));
    expect(shownIn).toEqual(["shorts"]);
  });

  it("starts each Short over at its Rule Speed, and holds it with the Speed Lock", async () => {
    await saveSetting("channelRules", [LISP_RULE]);
    await start(LISP, { player: "shorts" });
    press("KeyD", "d");
    expect(video("shorts").playbackRate).toBe(2.5);
    await navigate("/shorts/def", {
      details: { ...LISP_DETAILS, videoId: "def" },
      video: { ...LISP_VIDEO, title: "Closures", videoId: "def" },
    });
    expect(video("shorts").playbackRate).toBe(2);
    video("shorts").playbackRate = 1;
    video("shorts").dispatchEvent(new Event("ratechange"));
    await vi.advanceTimersByTimeAsync(100);
    expect(video("shorts").playbackRate).toBe(2);
  });

  it("hands a Short back at 1.0x once a watch page replaces it", async () => {
    await saveSetting("defaultSpeed", 1.5);
    await start(LISP, { player: "shorts" });
    expect(video("shorts").playbackRate).toBe(1.5);
    await navigate("/watch?v=abc", LISP, { player: "watch" });
    expect(video("shorts").playbackRate).toBe(1);
    expect(video("watch").playbackRate).toBe(1.5);
  });

  it("leaves a live stream alone, even while an ad plays before it", async () => {
    await saveSetting("defaultSpeed", 2);
    await start({ ...LISP, video: { ...LISP_VIDEO, isLive: true } });
    expect(video().playbackRate).toBe(1);
    expect(openPopup().last).toEqual({ kind: "none" });

    playerElement().classList.add("ad-showing");
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

    playerElement().classList.remove("ad-showing");
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

  it("records the channel name once reported, even after the handle and title", async () => {
    await start({ ...LISP, video: { ...LISP_VIDEO, author: "" } });
    const popup = openPopup();
    expect(popup.last).toEqual({ ...ready(1, { kind: "default" }), channelName: "@DailyLisp" });
    report = LISP;
    await vi.advanceTimersByTimeAsync(1000);
    expect(popup.last).toEqual(ready(1, { kind: "default" }));
    expect(channelName(await channelNamesItem.getValue(), "@DailyLisp")).toBe("Daily Lisp Talks");
  });

  it("keeps a popup up to date with changes that an earlier popup already saw", async () => {
    await saveSetting("channelRules", [LISP_RULE]);
    await start(LISP);
    const first = openPopup();
    await vi.advanceTimersByTimeAsync(1000);
    first.close();
    press("KeyD", "d");
    const second = openPopup();
    expect(second.last).toEqual(ready(2.5, { kind: "manual" }));
    await second.picked();
    expect(video().playbackRate).toBe(2);
    expect(second.last).toEqual(ready(2, { handle: "@dailylisp", kind: "channel" }));
  });

  it("keeps two open popups up to date when the second opens on a state not yet posted", async () => {
    await start({ video: { ...LISP_VIDEO, author: "" } });
    const first = openPopup();
    await vi.advanceTimersByTimeAsync(5100);
    // Past the read timeout, which the next look, a second later, would post.
    const second = openPopup();
    expect(second.last).toEqual({ kind: "unreadable" });
    // An ad restarts the wait for the channel, so reading it no longer times out.
    playerElement().classList.add("ad-showing");
    await vi.advanceTimersByTimeAsync(1000);
    expect(first.last).toEqual({ kind: "loading" });
    expect(second.last).toEqual({ kind: "loading" });
  });
});
