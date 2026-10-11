import { beforeEach, describe, expect, it } from "vitest";
import { fakeBrowser } from "wxt/testing/fake-browser";

import { browser } from "#imports";

import {
  channelName,
  channelNamesItem,
  getSettings,
  INITIAL_SETTINGS,
  rememberChannelName,
} from "./settings";

describe("settings", () => {
  beforeEach(() => fakeBrowser.reset());

  it("starts at 1.0x with no rules and S / D", async () => {
    expect(await getSettings()).toEqual(INITIAL_SETTINGS);
  });

  it("reads each setting from its own sync key, falling back alone when malformed", async () => {
    await browser.storage.sync.set({
      defaultSpeed: 1.25,
      titleRules: [{ id: "t", pattern: "asmr", speed: 1 }],
      channelRules: [{ handle: "@a", id: "a", speed: 2 }, { id: "b" }],
      shortcuts: "junk",
    });
    expect(await getSettings()).toEqual({
      ...INITIAL_SETTINGS,
      channelRules: [{ handle: "@a", id: "a", speed: 2 }],
      titleRules: [{ id: "t", pattern: "asmr", speed: 1 }],
    });
  });

  it("remembers channel names by handle, ignoring case", async () => {
    await rememberChannelName("@DailyLisp", "Daily Lisp Talks");
    expect(channelName(await channelNamesItem.getValue(), "@dailylisp")).toBe("Daily Lisp Talks");
  });
});
