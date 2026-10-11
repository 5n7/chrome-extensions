// @vitest-environment happy-dom
// @vitest-environment-options {"url": "https://www.twitch.tv/streamer"}
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";
import { ContentScriptContext } from "wxt/utils/content-script-context";

import { browser } from "#imports";
import { saveSetting } from "@/utils/settings";

import contentScript from "./index";

const PLAYER = `<div data-a-target="video-player" data-a-player-type="site"><div data-a-target="video-ref"><video></video><div class="player-controls__right-control-group"><div><button data-a-target="player-settings-button"></button></div></div></div></div>`;
const LIVE_CHAT = `<div data-test-selector="chat-scrollable-area__message-container"></div>`;
const VOD_CHAT = `<div class="video-chat__message-list-wrapper"><ul></ul></div>`;
const CHAT_LIST =
  '[data-test-selector="chat-scrollable-area__message-container"], .video-chat__message-list-wrapper ul';
const ownerLink = (login: string) =>
  `<div class="channel-info-content"><a href="/${login}"><h1>${login}</h1></a></div>`;
const liveLine = (text: string) =>
  `<div class="chat-line__message" data-a-user="viewer"><span data-a-target="chat-line-message-body"><span class="text-fragment">${text}</span></span></div>`;
const replayLine = (text: string) =>
  `<li><div class="vod-message"><div class="vod-message__header"><p>0:00</p></div><span class="chat-author__display-name" data-a-user="viewer">viewer</span><div class="video-chat__message"><span class="text-fragment">${text}</span></div></div></li>`;

let rooms: Record<string, () => Promise<unknown>>;
const room = (code: string) => ({
  room: { set: 1 },
  sets: { "1": { emoticons: [{ name: code, urls: { "1": `https://f/${code}` } }] } },
});

let ctx: ContentScriptContext | undefined;

beforeEach(() => {
  fakeBrowser.reset();
  history.replaceState(null, "", "/streamer");
  document.body.innerHTML = PLAYER + LIVE_CHAT;
  rooms = {};
  vi.stubGlobal("fetch", async (url: string) => {
    const login = /\/v1\/room\/(\w+)$/.exec(url)?.[1];
    const answer = login && rooms[login];
    return answer
      ? new Response(JSON.stringify(await answer()))
      : new Response("{}", { status: 404 });
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, "animate").mockImplementation(function (
    this: HTMLElement,
    ...args: Parameters<Element["animate"]>
  ) {
    const animation = Element.prototype.animate.apply(this, args);
    // Browsers mark a canceled animation's `finished` promise handled; happy-dom does not.
    animation.finished.catch(() => {});
    return animation;
  });
});

afterEach(() => {
  ctx?.abort();
  ctx = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const lookAgain = () => document.dispatchEvent(new Event("fullscreenchange"));

function start() {
  ctx = new ContentScriptContext("content");
  return contentScript.main(ctx);
}

async function run() {
  await start();
  await settle();
}

function holdReads() {
  const { sync } = fakeBrowser.storage;
  const get = sync.get.bind(sync);
  let release = () => {};
  const released = new Promise<void>((resolve) => (release = resolve));
  vi.spyOn(sync, "get").mockImplementation(async (keys) => {
    const read = await get(keys);
    await released;
    return read;
  });
  return release;
}

const area = () => document.querySelector<HTMLElement>("twitch-danmaku-area");
const areas = () => document.querySelectorAll("twitch-danmaku-area").length;
const button = () => document.querySelector<HTMLButtonElement>("[data-twitch-danmaku-button]");

function video() {
  const found = document.querySelector("video");
  if (!found) throw new Error("no video");
  return found;
}

function swapVideo() {
  const old = video();
  const swapped = document.createElement("video");
  old.parentElement?.append(swapped);
  old.remove();
  return swapped;
}

async function post(line: string) {
  await video().play();
  document.querySelector(CHAT_LIST)?.insertAdjacentHTML("beforeend", line);
  await settle();
}

function newestEmotes() {
  const newest = [...document.querySelectorAll("twitch-danmaku-comment")].at(-1);
  return [...(newest?.querySelectorAll("img") ?? [])].map((image) => image.alt);
}

describe("on a live Watch Page", () => {
  it("shows Danmaku over the video, with a button that hides it", async () => {
    await run();
    expect(area()?.previousElementSibling).toBe(video());
    expect(button()?.getAttribute("aria-label")).toBe("Hide danmaku");
  });

  it("starts with the stored settings", async () => {
    await browser.storage.sync.set({ opacity: 30 });
    await run();
    expect(area()?.style.opacity).toBe("0.3");
  });

  it("stays off while the stored settings load, even when another setting changes", async () => {
    await saveSetting("enabled", false);
    const release = holdReads();
    const started = start();
    await saveSetting("opacity", 50);
    await settle();
    expect(area()).toBeNull();
    release();
    await started;
    expect(area()).toBeNull();
  });

  it("starts with the stored settings and a change made while they load", async () => {
    await saveSetting("opacity", 30);
    const release = holdReads();
    const started = start();
    await saveSetting("laneCount", 12);
    await settle();
    release();
    await started;
    expect(area()?.style.opacity).toBe("0.3");
    expect(area()?.style.getPropertyValue("--lanes")).toBe("12");
  });

  it("keeps the running session while nothing changes", async () => {
    await run();
    const before = area();
    lookAgain();
    expect(area()).toBe(before);
  });

  it("starts over when Twitch swaps the video", async () => {
    await run();
    const swapped = swapVideo();
    lookAgain();
    expect(areas()).toBe(1);
    expect(area()?.previousElementSibling).toBe(swapped);
  });

  it("starts over when Twitch drops the Danmaku Area", async () => {
    await run();
    area()?.remove();
    lookAgain();
    expect(area()?.previousElementSibling).toBe(video());
  });

  it("stops, and removes its button, once the page is no longer a Watch Page", async () => {
    await run();
    history.replaceState(null, "", "/directory");
    lookAgain();
    expect(area()).toBeNull();
    expect(button()).toBeNull();
  });

  it("stops when Danmaku is turned off, and its button turns it back on", async () => {
    await run();
    await saveSetting("enabled", false);
    await settle();
    expect(area()).toBeNull();
    expect(button()?.getAttribute("aria-label")).toBe("Show danmaku");
    button()?.click();
    await settle();
    expect(area()).not.toBeNull();
    expect(button()?.getAttribute("aria-label")).toBe("Hide danmaku");
  });

  it("leaves its button as it was when sync storage refuses the toggle", async () => {
    await run();
    // Replaced rather than spied on, since a spy handles the rejection it records, and Vitest, like
    // chrome://extensions, reports one left unhandled.
    const { sync } = fakeBrowser.storage;
    const set = sync.set.bind(sync);
    Object.assign(sync, {
      set: () => Promise.reject(new Error("MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded")),
    });
    try {
      button()?.click();
      await settle();
    } finally {
      Object.assign(sync, { set });
    }
    expect(area()).not.toBeNull();
    expect(button()?.getAttribute("aria-label")).toBe("Hide danmaku");
  });

  it("applies a changed setting to the running session", async () => {
    await run();
    const before = area();
    await saveSetting("opacity", 40);
    await settle();
    expect(area()).toBe(before);
    expect(area()?.style.opacity).toBe("0.4");
  });

  it("shows the channel's Emotes, also after starting over", async () => {
    history.replaceState(null, "", "/emoter");
    rooms.emoter = async () => room("KEKW");
    await run();
    await post(liveLine("KEKW"));
    expect(newestEmotes()).toEqual(["KEKW"]);
    swapVideo();
    lookAgain();
    await settle();
    await post(liveLine("KEKW"));
    expect(newestEmotes()).toEqual(["KEKW"]);
  });

  it("never shows the previous channel's Emotes after moving to another one", async () => {
    let answerFirst = () => {};
    rooms.first = () => new Promise((resolve) => (answerFirst = () => resolve(room("FirstEmote"))));
    rooms.second = async () => room("SecondEmote");
    history.replaceState(null, "", "/first");
    await run();
    history.replaceState(null, "", "/second");
    lookAgain();
    await settle();
    answerFirst();
    await settle();
    await post(liveLine("FirstEmote SecondEmote"));
    expect(newestEmotes()).toEqual(["SecondEmote"]);
  });
});

describe("on a VOD page", () => {
  beforeEach(() => {
    history.replaceState(null, "", "/videos/42");
    document.body.innerHTML = PLAYER + VOD_CHAT;
  });

  it("loads the owner's Emotes once Twitch renders the channel link", async () => {
    rooms.owner = async () => room("OwnerEmote");
    await run();
    expect(area()).not.toBeNull();
    await post(replayLine("OwnerEmote"));
    expect(newestEmotes()).toEqual([]);
    document.body.insertAdjacentHTML("afterbegin", ownerLink("owner"));
    lookAgain();
    await settle();
    await post(replayLine("OwnerEmote gg"));
    expect(newestEmotes()).toEqual(["OwnerEmote"]);
  });

  it("keeps the current owner's Emotes when the previous owner's arrive last", async () => {
    let answerEarlier = () => {};
    rooms.earlier = () =>
      new Promise((resolve) => (answerEarlier = () => resolve(room("EarlierEmote"))));
    rooms.later = async () => room("LaterEmote");
    document.body.insertAdjacentHTML("afterbegin", ownerLink("earlier"));
    await run();
    document.querySelector(".channel-info-content a")?.setAttribute("href", "/later");
    lookAgain();
    await settle();
    answerEarlier();
    await settle();
    await post(replayLine("EarlierEmote LaterEmote"));
    expect(newestEmotes()).toEqual(["LaterEmote"]);
  });
});
