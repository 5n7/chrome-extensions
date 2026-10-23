// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import type { PlayerVideo } from "./player-bridge";
import { findStage, findTargetVideoId, readHandle, type Stage } from "./youtube";

const video = (overrides: Partial<PlayerVideo> = {}): PlayerVideo => ({
  author: "Daily Lisp Talks",
  isLive: false,
  title: "Macros",
  videoId: "abc",
  ...overrides,
});

/** The watch page's channel area, with the hover tooltip YouTube repeats the name in. */
function renderOwner({ href = "/@dailylisp", name = "Daily Lisp Talks", videoId = "abc" } = {}) {
  document.body.innerHTML = `
    <ytd-watch-flexy video-id="${videoId}">
      <ytd-watch-metadata>
        <ytd-video-owner-renderer>
          <a href="${href}"><img alt=""></a>
          <ytd-channel-name id="channel-name">
            <yt-formatted-string id="text"><a href="${href}">${name}</a></yt-formatted-string>
            <tp-yt-paper-tooltip><div id="tooltip">${name}</div></tp-yt-paper-tooltip>
          </ytd-channel-name>
        </ytd-video-owner-renderer>
      </ytd-watch-metadata>
    </ytd-watch-flexy>`;
}

afterEach(() => {
  document.body.innerHTML = "";
  history.replaceState(null, "", "/");
});

describe("findStage", () => {
  it.each([
    ["/watch?v=abc&t=10", { kind: "page", player: "watch", videoId: "abc" }],
    ["/shorts/abc", { kind: "page", player: "shorts", videoId: "abc" }],
  ])("takes the video at %s from its URL", (path, stage) => {
    history.replaceState(null, "", path);
    expect(findStage()).toEqual(stage);
  });

  it.each(["/", "/watch", "/@dailylisp/shorts", "/shorts"])("finds none at %s", (path) => {
    history.replaceState(null, "", path);
    expect(findStage()).toBeUndefined();
  });

  it("follows the watch player in the miniplayer, which the URL does not name", () => {
    document.body.innerHTML = `<ytd-app miniplayer-is-active></ytd-app>`;
    expect(findStage()).toEqual({ kind: "miniplayer", player: "watch" });
    history.replaceState(null, "", "/shorts/abc");
    expect(findStage()).toEqual({ kind: "page", player: "shorts", videoId: "abc" });
  });
});

describe("findTargetVideoId", () => {
  const watch: Stage = { kind: "page", player: "watch", videoId: "abc" };
  const miniplayer: Stage = { kind: "miniplayer", player: "watch" };

  it("takes the stage's video, even while an ad reports another", () => {
    expect(findTargetVideoId(watch, { video: video({ videoId: "ad123" }) }, undefined)).toBe("abc");
  });

  it("never takes a live stream, even while an ad plays before it", () => {
    expect(findTargetVideoId(watch, { video: video({ isLive: true }) }, undefined)).toBeUndefined();
    const details = { isLive: true, videoId: "abc" };
    const ad = video({ videoId: "ad123" });
    expect(findTargetVideoId(watch, { details, video: ad }, undefined)).toBeUndefined();
    expect(
      findTargetVideoId(watch, { details: { ...details, isLive: false }, video: ad }, undefined),
    ).toBe("abc");
  });

  it("ignores details left over from a live stream watched before", () => {
    const details = { isLive: true, videoId: "previous" };
    expect(findTargetVideoId(watch, { details, video: video() }, undefined)).toBe("abc");
  });

  it("follows the video playing on in the miniplayer, but not an ad in it", () => {
    document.body.innerHTML = `<div id="movie_player"></div>`;
    expect(findTargetVideoId(miniplayer, { video: video({ videoId: "next" }) }, "abc")).toBe(
      "next",
    );
    document.querySelector("#movie_player")?.classList.add("ad-showing");
    expect(findTargetVideoId(miniplayer, { video: video({ videoId: "ad123" }) }, "abc")).toBe(
      "abc",
    );
  });
});

describe("readHandle", () => {
  it("prefers the handle in the player's details for this video", () => {
    const details = {
      isLive: false,
      ownerUrl: "http://www.youtube.com/@DailyLisp",
      videoId: "abc",
    };
    expect(readHandle(video(), details)).toBe("@DailyLisp");
    renderOwner();
    expect(readHandle(video(), { ...details, videoId: "previous" })).toBe("@dailylisp");
  });

  it("reads the channel under the player once it shows this video's channel", () => {
    renderOwner();
    expect(readHandle(video(), undefined)).toBe("@dailylisp");
  });

  it("decodes handles in other scripts", () => {
    renderOwner({ href: "/@%E3%81%AB%E3%81%93" });
    expect(readHandle(video(), undefined)).toBe("@にこ");
  });

  it("ignores the previous video's channel", () => {
    renderOwner({ name: "Slow Cooking Notes" });
    expect(readHandle(video(), undefined)).toBeUndefined();
    renderOwner({ videoId: "previous" });
    expect(readHandle(video(), undefined)).toBeUndefined();
  });
});
