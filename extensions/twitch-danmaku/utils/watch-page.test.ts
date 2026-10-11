import { describe, expect, it } from "vitest";

import { pageKey, parseWatchPage } from "./watch-page";

describe("parseWatchPage", () => {
  it.each([
    ["https://www.twitch.tv/Shroud", { kind: "live", login: "shroud" }],
    ["https://www.twitch.tv/shroud/?referrer=raid", { kind: "live", login: "shroud" }],
    ["https://www.twitch.tv/videos/2245123456", { kind: "vod", videoId: "2245123456" }],
    ["https://www.twitch.tv/videos/2245123456?t=1h2m3s", { kind: "vod", videoId: "2245123456" }],
  ])("finds the Watch Page at %s", (url, page) => {
    expect(parseWatchPage(url)).toEqual(page);
  });

  it.each([
    "https://www.twitch.tv/",
    "https://www.twitch.tv/directory",
    "https://www.twitch.tv/settings",
    "https://www.twitch.tv/shroud/clip/FunnyClipSlug",
    "https://www.twitch.tv/shroud/videos",
    "https://www.twitch.tv/shroud/about",
    "https://www.twitch.tv/popout/shroud/chat",
    "https://www.twitch.tv/moderator/shroud",
    "https://www.twitch.tv/videos/abc",
    "https://clips.twitch.tv/FunnyClipSlug",
    "https://player.twitch.tv/?channel=shroud",
    "https://m.twitch.tv/shroud",
  ])("finds no Watch Page at %s", (url) => {
    expect(parseWatchPage(url)).toBeUndefined();
  });
});

describe("pageKey", () => {
  it("tells channels and VODs apart", () => {
    expect(pageKey({ kind: "live", login: "a" })).not.toBe(pageKey({ kind: "live", login: "b" }));
    expect(pageKey({ kind: "vod", videoId: "1" })).not.toBe(pageKey({ kind: "live", login: "1" }));
  });
});
