// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ContentScriptContext } from "wxt/utils/content-script-context";

import playerBridge from "@/entrypoints/player-bridge.content";

import { readPlayer, REQUEST_EVENT, RESPONSE_EVENT } from "./player-bridge";

function renderPlayer(id: string, videoId: string, handle: string) {
  const element = Object.assign(document.createElement("div"), {
    getPlayerResponse: () => ({
      microformat: {
        playerMicroformatRenderer: { ownerProfileUrl: `http://www.youtube.com/${handle}` },
      },
      videoDetails: { isLive: false, videoId },
    }),
    getVideoData: () => ({ author: handle, isLive: false, title: "Macros", video_id: videoId }),
    id,
  });
  document.body.append(element);
}

beforeAll(() => playerBridge.main(new ContentScriptContext("player-bridge")));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("readPlayer", () => {
  it("reads the named player, though the other one is in the page too", () => {
    renderPlayer("movie_player", "watched", "@watch");
    renderPlayer("shorts-player", "short", "@shorts");
    expect(readPlayer("shorts")).toEqual({
      details: { isLive: false, ownerUrl: "http://www.youtube.com/@shorts", videoId: "short" },
      video: { author: "@shorts", isLive: false, title: "Macros", videoId: "short" },
    });
    expect(readPlayer("watch").video?.videoId).toBe("watched");
  });

  it("reads nothing from a player that is not in the page", () => {
    renderPlayer("movie_player", "watched", "@watch");
    expect(readPlayer("shorts")).toEqual({});
  });

  it("leaves a request unanswered unless it names a player, not an Object.prototype key", () => {
    renderPlayer("movie_player", "watched", "@watch");
    let answered = false;
    const listener = () => (answered = true);
    document.addEventListener(RESPONSE_EVENT, listener);
    document.dispatchEvent(new CustomEvent(REQUEST_EVENT, { detail: "constructor" }));
    document.removeEventListener(RESPONSE_EVENT, listener);
    expect(answered).toBe(false);
  });
});
