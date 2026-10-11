// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startSession, type Session } from "./session";
import type { Settings } from "./settings";
import type { WatchPage } from "./watch-page";

const SETTINGS: Settings = {
  enabled: true,
  area: 70,
  laneCount: 10,
  opacity: 80,
  crossingTime: 8,
};
const LIVE: WatchPage = { kind: "live", login: "streamer" };
const VOD: WatchPage = { kind: "vod", videoId: "1" };

const liveLine = (text: string, login = "viewer") =>
  `<div class="chat-line__message" data-a-user="${login}"><span data-a-target="chat-line-message-body"><span class="text-fragment">${text}</span></span></div>`;

const replayLine = (seconds: number, text: string, login = "viewer") => {
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return `<li><div class="vod-message"><div class="vod-message__header"><p>${time}</p></div><span class="chat-author__display-name" data-a-user="${login}">${login}</span><div class="video-chat__message"><span>:</span><span class="text-fragment">${text}</span></div></div></li>`;
};

let session: Session | undefined;

beforeEach(() => {
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
  session?.destroy();
  session = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function comments() {
  return [...document.querySelectorAll("twitch-danmaku-comment")].map((comment) => {
    const [animation] = comment.getAnimations();
    return {
      text: comment.textContent,
      ms: Number(animation?.currentTime),
      playing: animation?.playState === "running",
    };
  });
}

const texts = () => comments().map((comment) => comment.text);

function mount(page: WatchPage, listed: readonly string[] = [], playback = { position: 0 }) {
  const player = document.createElement("div");
  const video = document.createElement("video");
  const state = { paused: false, seeking: false, position: playback.position };
  Object.defineProperties(video, {
    paused: { get: () => state.paused },
    seeking: { get: () => state.seeking },
    currentTime: { get: () => state.position },
  });
  player.append(video);
  const chatList = document.createElement("ul");
  chatList.innerHTML = listed.join("");
  document.body.append(player, chatList);

  const fire = (type: string) => video.dispatchEvent(new Event(type));
  return {
    state,
    chatList,
    start() {
      session = startSession({ key: "key", page, player, video, chatList }, SETTINGS);
    },
    async add(...lines: string[]) {
      chatList.insertAdjacentHTML("beforeend", lines.join(""));
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    pause() {
      state.paused = true;
      fire("pause");
    },
    play() {
      state.paused = false;
      fire("playing");
    },
    seeking() {
      state.seeking = true;
      fire("seeking");
    },
    seeked(position: number, listed: readonly string[]) {
      state.position = position;
      chatList.innerHTML = listed.join("");
      state.seeking = false;
      fire("seeked");
    },
  };
}

describe("a live session", () => {
  it("shows a message that arrives while the video plays, at the right edge", async () => {
    const page = mount(LIVE);
    page.start();
    await page.add(liveLine("gg"));
    const [comment, ...rest] = comments();
    expect(rest).toEqual([]);
    expect(comment?.text).toBe("gg");
    expect(comment?.ms).toBeLessThan(1000);
  });

  it("never Restores what Twitch listed before it started", () => {
    const page = mount(LIVE, [liveLine("old")]);
    page.start();
    page.pause();
    page.play();
    expect(texts()).toEqual([]);
  });

  it("shows the same message again when it is posted again", async () => {
    const page = mount(LIVE);
    page.start();
    await page.add(liveLine("gg"));
    await page.add(liveLine("gg"));
    expect(texts()).toEqual(["gg", "gg"]);
  });

  it("Drops a Command and a message that arrives while paused", async () => {
    const page = mount(LIVE);
    page.start();
    await page.add(liveLine("!uptime"));
    page.pause();
    await page.add(liveLine("late"));
    expect(texts()).toEqual([]);
  });

  it("Drops the backlog Twitch flushes when its tab comes back", async () => {
    const page = mount(LIVE);
    page.start();
    await page.add(...Array.from({ length: 31 }, (_, index) => liveLine(`m${index}`)));
    expect(texts()).toEqual([]);
  });

  it("stops Comments in place while paused", async () => {
    const page = mount(LIVE);
    page.start();
    await page.add(liveLine("gg"));
    page.pause();
    expect(comments().map((comment) => comment.playing)).toEqual([false]);
    page.play();
    expect(comments().map((comment) => comment.playing)).toEqual([true]);
  });
});

describe("a Chat Replay session", () => {
  it("Restores the listed messages on start, partway across by their lag", () => {
    const page = mount(
      VOD,
      [
        replayLine(60, "stale"),
        replayLine(95, "five"),
        replayLine(100, "now"),
        replayLine(110, "ahead"),
      ],
      { position: 100 },
    );
    page.start();
    const shown = comments();
    expect(shown.map((comment) => comment.text)).toEqual(["five", "now"]);
    // happy-dom advances animations in real time, so only their offset from each other is exact.
    expect(Number(shown[0]?.ms) - Number(shown[1]?.ms)).toBeCloseTo(5000, -2);
    expect(shown[1]?.ms).toBeLessThan(1000);
  });

  it("waits for the video to play before Restoring", () => {
    const page = mount(VOD, [replayLine(100, "now")], { position: 100 });
    page.state.paused = true;
    page.start();
    expect(texts()).toEqual([]);
    page.play();
    expect(texts()).toEqual(["now"]);
  });

  it("waits for the video to play before Restoring after a seek while paused", () => {
    const page = mount(VOD, [], { position: 100 });
    page.start();
    page.pause();
    page.seeking();
    page.seeked(300, [replayLine(300, "after")]);
    expect(texts()).toEqual([]);
    page.play();
    expect(texts()).toEqual(["after"]);
  });

  it("judges an arriving message by its Replay Time", async () => {
    const page = mount(VOD, [], { position: 100 });
    page.start();
    await page.add(replayLine(110, "ahead"), replayLine(99, "now"), replayLine(80, "stale"));
    expect(texts()).toEqual(["now"]);
  });

  it("Drops a message that arrives while paused", async () => {
    const page = mount(VOD, [], { position: 100 });
    page.start();
    page.pause();
    await page.add(replayLine(100, "late"));
    expect(texts()).toEqual([]);
  });

  it("shows a message Twitch re-adds only once, but a different one in the same second", async () => {
    const page = mount(VOD, [], { position: 100 });
    page.start();
    await page.add(replayLine(100, "gg"));
    await page.add(replayLine(100, "gg"));
    await page.add(replayLine(100, "gg", "other"), replayLine(100, "gg wp"));
    expect(texts()).toEqual(["gg", "gg", "gg wp"]);
  });

  it("clears the screen on a seek and Restores what Twitch lists at the new position", () => {
    const page = mount(VOD, [replayLine(100, "before")], { position: 100 });
    page.start();
    expect(texts()).toEqual(["before"]);
    page.seeking();
    expect(texts()).toEqual([]);
    page.seeked(302, [replayLine(100, "before"), replayLine(300, "after")]);
    expect(texts()).toEqual(["after"]);
  });

  it("shows a message again after seeking back to it", () => {
    const page = mount(VOD, [replayLine(100, "gg")], { position: 100 });
    page.start();
    page.seeking();
    page.seeked(100, [replayLine(100, "gg")]);
    expect(texts()).toEqual(["gg"]);
  });
});
