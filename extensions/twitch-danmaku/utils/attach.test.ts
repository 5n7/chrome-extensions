import { describe, expect, it } from "vitest";

import { planAttach, type Binding } from "./attach";

const binding: Binding = { key: "live:a", player: {}, video: {}, chatList: {} };

describe("planAttach", () => {
  it("attaches on a Watch Page and detaches when it is gone", () => {
    expect(planAttach(undefined, false, binding)).toBe("attach");
    expect(planAttach(binding, true, undefined)).toBe("detach");
    expect(planAttach(undefined, false, undefined)).toBe("keep");
  });

  it("keeps a session whose page and elements are unchanged, so running it again does nothing", () => {
    expect(planAttach(binding, true, { ...binding })).toBe("keep");
  });

  it.each([
    ["the channel", { key: "live:b" }],
    ["the player", { player: {} }],
    ["the video", { video: {} }],
    ["the chat list", { chatList: {} }],
  ])("replaces the session when %s changes", (_, change) => {
    expect(planAttach(binding, true, { ...binding, ...change })).toBe("replace");
  });

  it("replaces a session whose Danmaku Area Twitch removed from the page", () => {
    expect(planAttach(binding, false, { ...binding })).toBe("replace");
  });
});
