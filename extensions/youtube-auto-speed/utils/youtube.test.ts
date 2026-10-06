// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import type { PlayerVideo } from "./player-bridge";
import { findTargetVideoId, ownsKeyboard, readHandle } from "./youtube";

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

describe("findTargetVideoId", () => {
  it("takes a watch page's video from its URL, even while an ad reports another", () => {
    history.replaceState(null, "", "/watch?v=abc&t=10");
    expect(findTargetVideoId("ad123", undefined)).toBe("abc");
  });

  it("finds none on other pages", () => {
    history.replaceState(null, "", "/shorts/abc");
    expect(findTargetVideoId("abc", "abc")).toBeUndefined();
  });

  it("follows the video playing on in the miniplayer, but not an ad in it", () => {
    history.replaceState(null, "", "/");
    document.body.innerHTML = `<ytd-app miniplayer-is-active><div id="movie_player"></div></ytd-app>`;
    expect(findTargetVideoId("next", "abc")).toBe("next");
    document.querySelector("#movie_player")?.classList.add("ad-showing");
    expect(findTargetVideoId("ad123", "abc")).toBe("abc");
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

describe("ownsKeyboard", () => {
  function press(target: HTMLElement): boolean | undefined {
    document.body.append(target);
    let owned: boolean | undefined;
    target.addEventListener("keydown", (event) => (owned = ownsKeyboard(event)), { once: true });
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, code: "KeyS" }));
    target.remove();
    return owned;
  }

  it("leaves keys to text fields and editable regions", () => {
    expect(press(document.createElement("input"))).toBe(true);
    expect(press(document.createElement("textarea"))).toBe(true);
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    expect(press(editable)).toBe(true);
  });

  it("takes keys from buttons and the page", () => {
    expect(press(document.createElement("button"))).toBe(false);
    expect(press(document.createElement("div"))).toBe(false);
  });
});
