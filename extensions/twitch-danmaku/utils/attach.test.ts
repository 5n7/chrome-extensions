import { describe, expect, it } from "vitest";

import { canKeep, type Binding } from "./attach";

const binding: Binding = { key: "live:a", player: {}, video: {}, chatList: {} };

describe("canKeep", () => {
  it("keeps a session whose page and elements are unchanged, so running it again does nothing", () => {
    expect(canKeep(binding, true, { ...binding })).toBe(true);
  });

  it.each([
    ["the channel", { key: "live:b" }],
    ["the player", { player: {} }],
    ["the video", { video: {} }],
    ["the chat list", { chatList: {} }],
  ])("replaces the session when %s changes", (_, change) => {
    expect(canKeep(binding, true, { ...binding, ...change })).toBe(false);
  });

  it("replaces a session whose Danmaku Area Twitch removed from the page", () => {
    expect(canKeep(binding, false, { ...binding })).toBe(false);
  });
});
